import * as Y from 'yjs'
import { resolveArrowPoints } from '../connectors/resolve.js'
import { DEFAULT_STICKY_COLOR, pointsBounds, type StickyColor } from '../model/factory.js'
import { defaultAppState } from '../model/schema.js'
import type {
  AppState,
  ArrowElement,
  CameraState,
  Element,
  ElementId,
  Point,
  SceneSnapshot,
  ShapeType,
  Style,
} from '../model/types.js'
import {
  clipboardCenter,
  cloneSceneClipboard,
  createSceneClipboard,
  type SceneClipboardPayload,
} from './clipboard.js'
import { deriveSelectionStyle, type SelectionStyle } from './selectionStyle.js'

const DUPLICATE_OFFSET = 16
const DUPLICATE_OFFSET_POINT = { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET }

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}

function pointsEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false
  return a.every((point, index) => point.x === b[index]?.x && point.y === b[index]?.y)
}

function shallowEqualStyle(a: SelectionStyle, b: SelectionStyle): boolean {
  return (Object.keys(a) as (keyof SelectionStyle)[]).every((key) => a[key] === b[key])
}

function pasteOffsetForTarget(payload: SceneClipboardPayload, target: Point): Point {
  const center = clipboardCenter(payload)
  return { x: target.x - center.x, y: target.y - center.y }
}

export const TRANSACTION_ORIGIN = 'freedraw'
export const CAMERA_ORIGIN = 'freedraw:camera'

export interface TransactionApi {
  addElement(element: Element): void
  updateElement(id: ElementId, patch: Partial<Element>): void
  removeElement(id: ElementId): void
  reorder(order: ElementId[]): void
}

export interface PasteElementsOptions {
  payload?: SceneClipboardPayload | null
  target?: Point | null
}

export type ToolId =
  | 'select'
  | 'hand'
  | 'arrow'
  | 'line'
  | 'text'
  | 'sticky'
  | 'image'
  | 'freedraw'
  | 'shape'

export interface UiState {
  selectedIds: Set<ElementId>
  hoveredId: ElementId | null
  activeTool: ToolId
  activeShapeType: ShapeType
  activeStickyColor: StickyColor
  clipboardElementCount: number
}

type Subscriber = () => void

function toYElement(element: Element): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [key, value] of Object.entries(element)) map.set(key, value)
  return map
}

function fromYElement(map: Y.Map<unknown>): Element {
  return map.toJSON() as Element
}

export class SceneStore {
  readonly doc: Y.Doc
  private readonly yElements: Y.Map<Y.Map<unknown>>
  private readonly yOrder: Y.Array<ElementId>
  private readonly yAppState: Y.Map<unknown>

  private snapshot: SceneSnapshot
  private readonly subscribers = new Set<Subscriber>()

  private readonly uiSubscribers = new Set<Subscriber>()
  private uiState: UiState = {
    selectedIds: new Set(),
    hoveredId: null,
    activeTool: 'select',
    activeShapeType: 'rect',
    activeStickyColor: DEFAULT_STICKY_COLOR,
    clipboardElementCount: 0,
  }

  private readonly arrowsByShape = new Map<ElementId, Set<ElementId>>()
  private selectionStyle: SelectionStyle | null = null
  private clipboard: SceneClipboardPayload | null = null
  private clipboardPasteCount = 0

  private readonly undoManager: Y.UndoManager
  private readonly historySubscribers = new Set<Subscriber>()

  needsRender = true

  constructor(doc: Y.Doc = new Y.Doc()) {
    this.doc = doc
    this.yElements = doc.getMap('elements')
    this.yOrder = doc.getArray('elementOrder')
    this.yAppState = doc.getMap('appState')

    this.migrateArrows()
    this.resolveArrows()
    this.snapshot = this.buildSnapshot()
    this.rebuildBindingIndex()

    this.undoManager = new Y.UndoManager([this.yElements, this.yOrder, this.yAppState], {
      trackedOrigins: new Set([TRANSACTION_ORIGIN]),
      captureTimeout: 500,
    })
    this.undoManager.on('stack-item-added', this.onHistoryChanged)
    this.undoManager.on('stack-item-popped', this.onHistoryChanged)

    this.yElements.observeDeep(this.onElementsChanged)
    this.yOrder.observe(this.onOrderChanged)
    this.yAppState.observe(this.onAppStateChanged)
  }

  getSnapshot(): SceneSnapshot {
    return this.snapshot
  }

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb)
    return () => this.subscribers.delete(cb)
  }

  getUiState(): UiState {
    return this.uiState
  }

  subscribeUi(cb: Subscriber): () => void {
    this.uiSubscribers.add(cb)
    return () => this.uiSubscribers.delete(cb)
  }

  setUiState(patch: Partial<UiState>): void {
    this.uiState = { ...this.uiState, ...patch }
    this.uiSubscribers.forEach((cb) => cb())
  }

  arrowsForShape(shapeId: ElementId): ReadonlySet<ElementId> {
    return this.arrowsByShape.get(shapeId) ?? new Set()
  }

  transact(fn: (api: TransactionApi) => void): void {
    this.doc.transact(() => {
      fn(this.txnApi)
      this.resolveArrows()
    }, TRANSACTION_ORIGIN)
  }

  commitCamera(camera: CameraState): void {
    this.doc.transact(() => this.yAppState.set('camera', camera), CAMERA_ORIGIN)
  }

  deleteElements(ids: Iterable<ElementId>): void {
    const removal = this.removalIdsFor(ids)
    if (removal.length === 0) return
    this.transact((api) => removal.forEach((id) => api.removeElement(id)))
    this.deselect(removal)
  }

  duplicateElements(ids: Iterable<ElementId>): ElementId[] {
    const payload = createSceneClipboard(this.snapshot, ids)
    if (!payload) return []
    const { elements: clones, ids: cloneIds } = cloneSceneClipboard(payload, DUPLICATE_OFFSET_POINT)
    this.stopCapturing()
    this.transact((api) => clones.forEach((clone) => api.addElement(clone)))
    this.stopCapturing()
    this.setUiState({ selectedIds: new Set(cloneIds) })
    return cloneIds
  }

  createClipboard(ids: Iterable<ElementId>): SceneClipboardPayload | null {
    return createSceneClipboard(this.snapshot, ids)
  }

  copyElements(ids: Iterable<ElementId>): SceneClipboardPayload | null {
    const payload = this.createClipboard(ids)
    if (!payload) return null
    this.clipboard = payload
    this.clipboardPasteCount = 0
    this.setUiState({ clipboardElementCount: payload.elements.length })
    return payload
  }

  cutElements(ids: Iterable<ElementId>): SceneClipboardPayload | null {
    const removal = this.removalIdsFor(ids)
    if (removal.length === 0) return null
    const payload = createSceneClipboard(this.snapshot, removal)
    if (!payload) return null
    this.clipboard = payload
    this.clipboardPasteCount = 0
    this.stopCapturing()
    this.transact((api) => removal.forEach((id) => api.removeElement(id)))
    this.stopCapturing()
    this.deselect(removal)
    this.setUiState({ clipboardElementCount: payload.elements.length, activeTool: 'select' })
    return payload
  }

  pasteElements(options: PasteElementsOptions = {}): ElementId[] {
    const payload = Object.hasOwn(options, 'payload') ? options.payload : this.clipboard
    if (!payload) return []
    const pasteCount = this.clipboard?.id === payload.id ? this.clipboardPasteCount + 1 : 1
    const offset = options.target
      ? pasteOffsetForTarget(payload, options.target)
      : { x: DUPLICATE_OFFSET * pasteCount, y: DUPLICATE_OFFSET * pasteCount }
    const { elements: clones, ids: cloneIds } = cloneSceneClipboard(payload, offset)
    if (clones.length === 0) return []
    this.stopCapturing()
    this.transact((api) => clones.forEach((clone) => api.addElement(clone)))
    this.stopCapturing()
    this.clipboard = payload
    this.clipboardPasteCount = pasteCount
    this.setUiState({
      selectedIds: new Set(cloneIds),
      activeTool: 'select',
      clipboardElementCount: payload.elements.length,
    })
    return cloneIds
  }

  updateStyle(ids: Iterable<ElementId>, patch: Partial<Style>): void {
    const targets = [...ids].filter((id) => this.yElements.has(id))
    if (targets.length === 0) return
    this.transact((api) => {
      for (const id of targets) {
        const element = this.snapshot.elements[id]
        if (!element) continue
        const label =
          patch.textAlign && element.label
            ? { ...element.label, align: patch.textAlign }
            : element.label
        api.updateElement(id, { style: { ...element.style, ...patch }, ...(label ? { label } : {}) })
      }
    })
    this.updateLastUsedStyle(patch)
  }

  updateArrowheads(ids: Iterable<ElementId>, patch: Partial<Pick<ArrowElement, 'startArrowhead' | 'endArrowhead'>>): void {
    const targets = [...ids].filter((id) => {
      const element = this.snapshot.elements[id]
      return element ? isArrow(element) : false
    })
    if (targets.length === 0) return
    this.transact((api) => {
      for (const id of targets) api.updateElement(id, patch)
    })
  }

  getLastUsedStyle(): Style {
    return this.snapshot.appState.lastUsedStyle
  }

  updateLastUsedStyle(patch: Partial<Style>): void {
    const next = { ...this.snapshot.appState.lastUsedStyle, ...patch }
    this.doc.transact(() => this.yAppState.set('lastUsedStyle', next), CAMERA_ORIGIN)
  }

  getSelectionStyle(): SelectionStyle {
    const selected = [...this.uiState.selectedIds]
      .map((id) => this.snapshot.elements[id])
      .filter((element): element is Element => Boolean(element))
    const next = deriveSelectionStyle(selected, this.snapshot.appState.lastUsedStyle)
    if (this.selectionStyle && shallowEqualStyle(this.selectionStyle, next)) {
      return this.selectionStyle
    }
    this.selectionStyle = next
    return next
  }

  subscribeStyle(cb: Subscriber): () => void {
    const unsubscribe = this.subscribe(cb)
    const unsubscribeUi = this.subscribeUi(cb)
    return () => {
      unsubscribe()
      unsubscribeUi()
    }
  }

  private deselect(ids: ElementId[]): void {
    const selected = new Set(this.uiState.selectedIds)
    let changed = false
    for (const id of ids) {
      if (selected.delete(id)) changed = true
    }
    if (changed) this.setUiState({ selectedIds: selected })
  }

  private removalIdsFor(ids: Iterable<ElementId>): ElementId[] {
    const direct = [...ids].filter((id) => this.yElements.has(id))
    if (direct.length === 0) return []
    const removal = new Set(direct)
    for (const id of direct) {
      for (const arrowId of this.arrowsForShape(id)) removal.add(arrowId)
    }
    return [...removal]
  }

  stopCapturing(): void {
    this.undoManager.stopCapturing()
  }

  undo(): void {
    this.undoManager.undo()
  }

  redo(): void {
    this.undoManager.redo()
  }

  get canUndo(): boolean {
    return this.undoManager.canUndo()
  }

  get canRedo(): boolean {
    return this.undoManager.canRedo()
  }

  subscribeHistory(cb: Subscriber): () => void {
    this.historySubscribers.add(cb)
    return () => this.historySubscribers.delete(cb)
  }

  destroy(): void {
    this.undoManager.off('stack-item-added', this.onHistoryChanged)
    this.undoManager.off('stack-item-popped', this.onHistoryChanged)
    this.undoManager.destroy()
    this.yElements.unobserveDeep(this.onElementsChanged)
    this.yOrder.unobserve(this.onOrderChanged)
    this.yAppState.unobserve(this.onAppStateChanged)
    this.subscribers.clear()
    this.uiSubscribers.clear()
    this.historySubscribers.clear()
  }

  private readonly txnApi: TransactionApi = {
    addElement: (element) => {
      this.yElements.set(element.id, toYElement(element))
      this.yOrder.push([element.id])
    },
    updateElement: (id, patch) => {
      const map = this.yElements.get(id)
      if (!map) return
      for (const [key, value] of Object.entries(patch)) map.set(key, value)
    },
    removeElement: (id) => {
      this.yElements.delete(id)
      const index = this.yOrder.toArray().indexOf(id)
      if (index >= 0) this.yOrder.delete(index, 1)
    },
    reorder: (order) => {
      this.yOrder.delete(0, this.yOrder.length)
      this.yOrder.push(order)
    },
  }

  private readonly onHistoryChanged = (): void => {
    this.historySubscribers.forEach((cb) => cb())
  }

  private readLiveElements(): Record<ElementId, Element> {
    const elements: Record<ElementId, Element> = {}
    this.yElements.forEach((map, id) => {
      elements[id] = fromYElement(map)
    })
    return elements
  }

  private migrateArrows(): void {
    this.doc.transact(() => {
      this.yElements.forEach((map) => {
        const element = fromYElement(map)
        if (!isArrow(element)) return
        if (Array.isArray(element.route)) return
        const collapsed = element.start || element.end
        const source = collapsed
          ? [element.points[0]!, element.points[element.points.length - 1]!]
          : element.points
        map.set('points', source)
        map.set('route', [])
      })
    }, TRANSACTION_ORIGIN)
  }

  private resolveArrows(): void {
    const elements = this.readLiveElements()
    for (const element of Object.values(elements)) {
      if (!isArrow(element)) continue
      const nextRoute = resolveArrowPoints(element, elements)
      if (pointsEqual(nextRoute, element.route)) continue
      const map = this.yElements.get(element.id)
      if (!map) continue
      map.set('route', nextRoute)
      const bounds = pointsBounds(nextRoute)
      map.set('x', bounds.x)
      map.set('y', bounds.y)
      map.set('width', bounds.width)
      map.set('height', bounds.height)
    }
  }

  private buildSnapshot(): SceneSnapshot {
    const elements: Record<ElementId, Element> = {}
    this.yElements.forEach((map, id) => {
      elements[id] = fromYElement(map)
    })
    return {
      elements,
      order: this.yOrder.toArray(),
      appState: this.readAppState(),
    }
  }

  private readAppState(): AppState {
    const fallback = defaultAppState()
    const json = this.yAppState.toJSON() as Partial<AppState>
    return {
      schemaVersion: json.schemaVersion ?? fallback.schemaVersion,
      camera: json.camera ?? fallback.camera,
      lastUsedStyle: json.lastUsedStyle ?? fallback.lastUsedStyle,
    }
  }

  private readonly onElementsChanged = (events: Y.YEvent<Y.Map<unknown>>[]): void => {
    const elements = { ...this.snapshot.elements }
    for (const event of events) {
      if (event.target === this.yElements) {
        event.changes.keys.forEach((change, id) => {
          if (change.action === 'delete') {
            delete elements[id]
            return
          }
          const map = this.yElements.get(id)
          if (map) elements[id] = fromYElement(map)
        })
        continue
      }
      const map = event.target as Y.Map<unknown>
      const id = map.get('id') as ElementId | undefined
      if (id && this.yElements.has(id)) elements[id] = fromYElement(map)
    }
    this.snapshot = { ...this.snapshot, elements }
    this.rebuildBindingIndex()
    this.invalidate()
  }

  private readonly onOrderChanged = (): void => {
    this.snapshot = { ...this.snapshot, order: this.yOrder.toArray() }
    this.invalidate()
  }

  private readonly onAppStateChanged = (): void => {
    this.snapshot = { ...this.snapshot, appState: this.readAppState() }
    this.invalidate()
  }

  private rebuildBindingIndex(): void {
    this.arrowsByShape.clear()
    for (const element of Object.values(this.snapshot.elements)) {
      if (element.type !== 'arrow' && element.type !== 'line') continue
      for (const binding of [element.start, element.end]) {
        if (!binding) continue
        const set = this.arrowsByShape.get(binding.elementId) ?? new Set()
        set.add(element.id)
        this.arrowsByShape.set(binding.elementId, set)
      }
    }
  }

  private invalidate(): void {
    this.needsRender = true
    this.subscribers.forEach((cb) => cb())
  }
}
