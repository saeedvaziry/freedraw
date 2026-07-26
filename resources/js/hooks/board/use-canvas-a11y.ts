import { useEffect } from 'react'
import { elementBounds, expandGroupSelection, isArrowElement, pointsBounds } from '@freedraw/engine'
import type {
  EditorController,
  Element,
  ElementId,
  SceneSnapshot,
  SceneStore,
} from '@freedraw/engine'
import { SHAPES } from '@/components/board/toolbar/shapes.js'

export const NUDGE_STEP = 1
export const NUDGE_LARGE_STEP = 10

const LABEL_MAX_LENGTH = 40

const ELEMENT_LABELS: Record<string, string> = {
  ...Object.fromEntries(SHAPES.map((shape) => [shape.type, shape.label])),
  sticky: 'Sticky note',
  text: 'Text',
  image: 'Image',
  freedraw: 'Freehand drawing',
  arrow: 'Arrow',
  line: 'Line',
}

export type TraverseDirection = 'next' | 'previous'

export type NudgeDirection = 'left' | 'right' | 'up' | 'down'

export interface NudgeVector {
  dx: number
  dy: number
  direction: NudgeDirection
  distance: number
}

export interface CanvasAnnouncement {
  token: number
  message: string
}

type AnnouncementListener = (announcement: CanvasAnnouncement) => void

const announcementListeners = new Set<AnnouncementListener>()
let announcementToken = 0

export function announceCanvas(message: string): void {
  announcementToken += 1
  const announcement: CanvasAnnouncement = { token: announcementToken, message }
  announcementListeners.forEach((listener) => listener(announcement))
}

export function subscribeCanvasAnnouncements(listener: AnnouncementListener): () => void {
  announcementListeners.add(listener)
  return () => {
    announcementListeners.delete(listener)
  }
}

export function useCanvasA11y(store: SceneStore): void {
  useEffect(
    () =>
      store.subscribeSelection(() => {
        announceCanvas(selectionAnnouncement(store.getSnapshot(), store.getUiState().selectedIds))
      }),
    [store],
  )
}

export function nudgeVector(key: string, large: boolean): NudgeVector | null {
  const distance = large ? NUDGE_LARGE_STEP : NUDGE_STEP
  switch (key) {
    case 'ArrowLeft':
      return { dx: -distance, dy: 0, direction: 'left', distance }
    case 'ArrowRight':
      return { dx: distance, dy: 0, direction: 'right', distance }
    case 'ArrowUp':
      return { dx: 0, dy: -distance, direction: 'up', distance }
    case 'ArrowDown':
      return { dx: 0, dy: distance, direction: 'down', distance }
    default:
      return null
  }
}

export function traverseKeyDirection(key: string): TraverseDirection | null {
  if (key === 'PageDown') return 'next'
  if (key === 'PageUp') return 'previous'
  return null
}

export function translateElements(
  store: SceneStore,
  ids: Iterable<ElementId>,
  dx: number,
  dy: number,
): ElementId[] {
  const snapshot = store.getSnapshot()
  const targets = [...expandGroupSelection(ids, snapshot)].filter((id) => isMovable(snapshot, id))
  if (targets.length === 0) return []
  store.stopCapturing()
  store.transact((api) => {
    for (const id of targets) {
      const element = snapshot.elements[id]
      if (element) api.updateElement(id, translatedPatch(element, dx, dy))
    }
  })
  store.stopCapturing()
  return targets
}

export function traverseSelection(
  store: SceneStore,
  direction: TraverseDirection,
): ElementId | null {
  const snapshot = store.getSnapshot()
  const order = snapshot.order.filter((id) => isMovable(snapshot, id))
  if (order.length === 0) return null
  const id = order[anchorIndex(order, store.getUiState().selectedIds, direction)]
  if (!id) return null
  store.setUiState({ selectedIds: expandGroupSelection([id], snapshot), activeTool: 'select' })
  return id
}

export function revealElement(
  controller: EditorController | null,
  snapshot: SceneSnapshot,
  id: ElementId,
): void {
  if (!controller) return
  const element = snapshot.elements[id]
  if (!element) return
  const { width, height } = controller.viewportSize
  if (width === 0 || height === 0) return
  const camera = controller.getViewport()
  const view = {
    x: camera.x,
    y: camera.y,
    width: width / camera.zoom,
    height: height / camera.zoom,
  }
  const bounds = elementBounds(element)
  const visible =
    bounds.x >= view.x &&
    bounds.y >= view.y &&
    bounds.x + bounds.width <= view.x + view.width &&
    bounds.y + bounds.height <= view.y + view.height
  if (visible) return
  controller.focusViewport({
    x: bounds.x + bounds.width / 2 - view.width / 2,
    y: bounds.y + bounds.height / 2 - view.height / 2,
    zoom: camera.zoom,
  })
}

export function selectionAnnouncement(
  snapshot: SceneSnapshot,
  selectedIds: ReadonlySet<ElementId>,
): string {
  const order = snapshot.order.filter((id) => snapshot.elements[id])
  if (selectedIds.size === 0) return 'Nothing selected'
  if (selectedIds.size === 1) {
    const [id] = selectedIds
    const element = snapshot.elements[id]
    if (!element) return 'Nothing selected'
    return `${describeElement(element)}, ${order.indexOf(id) + 1} of ${order.length} selected`
  }
  return `${selectedIds.size} of ${order.length} elements selected`
}

export function nudgeAnnouncement(
  snapshot: SceneSnapshot,
  ids: readonly ElementId[],
  vector: NudgeVector,
): string {
  const element = snapshot.elements[ids[0]]
  const subject = ids.length === 1 && element ? describeElement(element) : `${ids.length} elements`
  return `Moved ${subject} ${vector.direction} by ${vector.distance}`
}

export function describeElement(element: Element): string {
  const kind = ELEMENT_LABELS[element.type] ?? 'Element'
  const text = elementText(element)
  const named = text.length > 0 ? `${kind} "${text}"` : kind
  return element.locked ? `${named}, locked` : named
}

function isMovable(snapshot: SceneSnapshot, id: ElementId): boolean {
  const element = snapshot.elements[id]
  return element != null && !element.locked
}

function elementText(element: Element): string {
  const raw = element.type === 'text' ? element.text : (element.label?.text ?? '')
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text.length <= LABEL_MAX_LENGTH) return text
  return `${text.slice(0, LABEL_MAX_LENGTH)}…`
}

function anchorIndex(
  order: readonly ElementId[],
  selectedIds: ReadonlySet<ElementId>,
  direction: TraverseDirection,
): number {
  let anchor = -1
  for (const [index, id] of order.entries()) {
    if (!selectedIds.has(id)) continue
    if (anchor === -1 || direction === 'next') anchor = index
  }
  if (anchor === -1) return direction === 'next' ? 0 : order.length - 1
  return (anchor + (direction === 'next' ? 1 : -1) + order.length) % order.length
}

function translatedPatch(element: Element, dx: number, dy: number): Partial<Element> {
  if (isArrowElement(element) || element.type === 'freedraw') {
    const points = element.points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
    return { points, ...pointsBounds(points) }
  }
  return { x: element.x + dx, y: element.y + dy }
}
