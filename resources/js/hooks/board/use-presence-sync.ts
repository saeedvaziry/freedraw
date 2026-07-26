import { useEffect, useMemo } from 'react'
import { selectionFrameFor } from '@freedraw/engine'
import type {
  CameraState,
  EditorController,
  Element,
  PresenceOverlay,
  SceneStore,
  SelectionFrame,
  ToolId,
  TransientKind,
} from '@freedraw/engine'
import {
  createPresenceOverlayMapper,
  isEmptyPresenceOverlay,
  samePresenceOverlay,
  PRESENCE_STALE_MS,
  type PresenceAwareness,
  type PresenceDrag,
  type PresenceDragGhost,
  type PresenceDragKind,
  type PresenceParticipant,
  type PresencePoint,
  type PresenceViewport,
} from '@/lib/presence'
import type { PageSync } from '@/lib/persistence'
import { usePresence, type UsePresenceResult } from './use-presence.js'

const NO_SELECTION: readonly string[] = []
const DRAG_EPSILON = 1e-6

export interface PresenceCanvas {
  subscribeCursor(listener: (point: PresencePoint | null) => void): () => void
  subscribeCamera(listener: (camera: CameraState) => void): () => void
  subscribeTransient(
    listener: (elements: readonly Element[] | null, kind?: TransientKind) => void,
  ): () => void
  setPresenceOverlay(presence: PresenceOverlay | null): void
  getViewport(): CameraState
  readonly cursorWorldPoint: PresencePoint | null
  readonly viewportSize: { width: number; height: number }
}

export interface PresenceScene {
  getSnapshot(): { elements: Record<string, Element> }
  getUiState(): { selectedIds: ReadonlySet<string>; activeTool: ToolId }
  subscribe(listener: () => void): () => void
  subscribeSelection(listener: () => void): () => void
  subscribeChrome(listener: () => void): () => void
}

export interface PresencePublisher {
  setCursor(point: PresencePoint | null): void
  setSelection(ids: readonly string[]): void
  setTool(tool: ToolId | null): void
  setViewport(viewport: PresenceViewport | null): void
  setDrag(drag: PresenceDrag | null): void
}

export interface PresenceReader {
  readParticipants(): PresenceParticipant[]
  subscribe(listener: () => void): () => void
}

export interface AttachPresencePublisherOptions {
  canvas: PresenceCanvas
  scene: PresenceScene
  publisher: PresencePublisher
  readOnly?: boolean
}

export interface AttachPresenceOverlayOptions {
  canvas: PresenceCanvas
  scene: PresenceScene
  reader: PresenceReader
  now?: () => number
  ttlMs?: number
  halos?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPresenceAwareness(value: unknown): value is PresenceAwareness {
  if (!isRecord(value)) return false
  return (
    typeof value.clientID === 'number' &&
    typeof value.getLocalState === 'function' &&
    typeof value.setLocalState === 'function' &&
    typeof value.setLocalStateField === 'function' &&
    typeof value.getStates === 'function' &&
    typeof value.on === 'function' &&
    typeof value.off === 'function'
  )
}

export function presenceAwarenessFrom(sync: PageSync | null): PresenceAwareness | null {
  if (sync === null || !('awareness' in sync)) return null
  const { awareness } = sync
  return isPresenceAwareness(awareness) ? awareness : null
}

function sameIds(list: readonly string[], ids: ReadonlySet<string>): boolean {
  if (list.length !== ids.size) return false
  for (const id of list) {
    if (!ids.has(id)) return false
  }
  return true
}

function dragKindFor(
  elements: readonly Element[],
  committed: Record<string, Element>,
): PresenceDragKind {
  let rotated = false
  for (const element of elements) {
    const before = committed[element.id]
    if (!before) return 'create'
    if (
      Math.abs(before.width - element.width) > DRAG_EPSILON ||
      Math.abs(before.height - element.height) > DRAG_EPSILON
    ) {
      return 'resize'
    }
    if (Math.abs(before.rotation - element.rotation) > DRAG_EPSILON) rotated = true
  }
  return rotated ? 'rotate' : 'move'
}

function previewKindFor(tool: ToolId): PresenceDragKind {
  return tool === 'freedraw' ? 'draw' : 'create'
}

function ghostFor(
  elements: readonly Element[],
  committed: Record<string, Element>,
): PresenceDragGhost | null {
  const ids: string[] = []
  let dx = 0
  let dy = 0
  for (const element of elements) {
    const before = committed[element.id]
    if (!before) return null
    const nextX = element.x - before.x
    const nextY = element.y - before.y
    if (ids.length === 0) {
      dx = nextX
      dy = nextY
    } else if (Math.abs(nextX - dx) > DRAG_EPSILON || Math.abs(nextY - dy) > DRAG_EPSILON) {
      return null
    }
    ids.push(element.id)
  }
  return ids.length === 0 ? null : { ids, dx, dy }
}

export function attachPresencePublisher(options: AttachPresencePublisherOptions): () => void {
  const { canvas, scene, publisher, readOnly = false } = options
  const cleanups: Array<() => void> = []
  let inside = false
  let selection: readonly string[] = NO_SELECTION
  let lastX = Number.NaN
  let lastY = Number.NaN
  let lastZoom = Number.NaN
  let lastWidth = Number.NaN
  let lastHeight = Number.NaN

  const publishViewport = (camera: CameraState): void => {
    const { width, height } = canvas.viewportSize
    if (
      camera.x === lastX &&
      camera.y === lastY &&
      camera.zoom === lastZoom &&
      width === lastWidth &&
      height === lastHeight
    ) {
      return
    }
    lastX = camera.x
    lastY = camera.y
    lastZoom = camera.zoom
    lastWidth = width
    lastHeight = height
    const zoom = camera.zoom > 0 ? camera.zoom : 1
    publisher.setViewport({
      x: camera.x,
      y: camera.y,
      width: width / zoom,
      height: height / zoom,
      zoom: camera.zoom,
    })
    if (inside) publisher.setCursor(canvas.cursorWorldPoint)
  }

  cleanups.push(
    canvas.subscribeCursor((point) => {
      inside = point !== null
      publisher.setCursor(point)
    }),
  )
  cleanups.push(canvas.subscribeCamera(publishViewport))
  publishViewport(canvas.getViewport())

  if (readOnly) {
    publisher.setSelection(NO_SELECTION)
    publisher.setTool(null)
    publisher.setDrag(null)
  } else {
    const publishSelection = (): void => {
      const ids = scene.getUiState().selectedIds
      if (sameIds(selection, ids)) return
      selection = [...ids]
      publisher.setSelection(selection)
    }
    const publishTool = (): void => {
      publisher.setTool(scene.getUiState().activeTool)
    }
    const publishDrag = (
      elements: readonly Element[] | null,
      source: TransientKind = 'transient',
    ): void => {
      if (elements === null || elements.length === 0) {
        publisher.setDrag(null)
        return
      }
      const ui = scene.getUiState()
      const owned = elements.filter((element) => ui.selectedIds.has(element.id))
      const dragged = owned.length === 0 ? [...elements] : owned
      const frame = selectionFrameFor(dragged)
      if (frame === null) {
        publisher.setDrag(null)
        return
      }
      if (source === 'preview') {
        publisher.setDrag({
          kind: previewKindFor(ui.activeTool),
          frame,
          ghost: null,
          preview: true,
        })
        return
      }
      const committed = scene.getSnapshot().elements
      const kind = dragKindFor(dragged, committed)
      publisher.setDrag({
        kind,
        frame,
        ghost: kind === 'move' ? ghostFor(dragged, committed) : null,
      })
    }
    cleanups.push(canvas.subscribeTransient(publishDrag))
    cleanups.push(scene.subscribeSelection(publishSelection))
    cleanups.push(scene.subscribeChrome(publishTool))
    publishSelection()
    publishTool()
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup())
    publisher.setCursor(null)
    if (!readOnly) {
      publisher.setSelection(NO_SELECTION)
      publisher.setTool(null)
      publisher.setDrag(null)
    }
  }
}

export function attachPresenceOverlay(options: AttachPresenceOverlayOptions): () => void {
  const { canvas, scene, reader, now = Date.now, halos = true } = options
  const ttlMs = options.ttlMs ?? PRESENCE_STALE_MS
  const mapper = createPresenceOverlayMapper()
  let painted: PresenceOverlay | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let deadline = Number.POSITIVE_INFINITY

  const resolveFrame = (ids: readonly string[]): SelectionFrame | null => {
    const { elements } = scene.getSnapshot()
    const found: Element[] = []
    for (const id of ids) {
      const element = elements[id]
      if (element) found.push(element)
    }
    return found.length === 0 ? null : selectionFrameFor(found)
  }

  const resolveGhost = (
    ids: readonly string[],
    dx: number,
    dy: number,
  ): SelectionFrame[] | null => {
    const { elements } = scene.getSnapshot()
    const frames: SelectionFrame[] = []
    for (const id of ids) {
      const element = elements[id]
      if (!element) continue
      frames.push({
        bounds: {
          x: element.x + dx,
          y: element.y + dy,
          width: element.width,
          height: element.height,
        },
        rotation: element.rotation,
        center: {
          x: element.x + dx + element.width / 2,
          y: element.y + dy + element.height / 2,
        },
      })
    }
    return frames.length === 0 ? null : frames
  }

  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    deadline = Number.POSITIVE_INFINITY
  }

  const sweep = (participants: readonly PresenceParticipant[], at: number): void => {
    let next = Number.POSITIVE_INFINITY
    for (const participant of participants) {
      if (participant.isLocal) continue
      const expires = participant.updatedAt + ttlMs
      if (expires >= at && expires < next) next = expires
    }
    if (next === deadline) return
    cancel()
    if (next === Number.POSITIVE_INFINITY) return
    deadline = next
    timer = setTimeout(() => {
      timer = null
      deadline = Number.POSITIVE_INFINITY
      render()
    }, next - at + 1)
  }

  const render = (): void => {
    const at = now()
    const participants = reader.readParticipants()
    const next = mapper.build(participants, {
      resolveFrame,
      resolveGhost,
      scene: scene.getSnapshot(),
      now: at,
      ttlMs,
      halos,
    })
    sweep(participants, at)
    if (painted !== null && samePresenceOverlay(painted, next)) return
    painted = next
    canvas.setPresenceOverlay(isEmptyPresenceOverlay(next) ? null : next)
  }

  const cleanups = [reader.subscribe(render), scene.subscribe(render)]
  render()

  return () => {
    cancel()
    cleanups.forEach((cleanup) => cleanup())
    canvas.setPresenceOverlay(null)
  }
}

export interface UsePresenceSyncOptions {
  controller: EditorController | null
  store: SceneStore
  sync: PageSync | null
  readOnly?: boolean
  previewing?: boolean
  enabled?: boolean
}

export function usePresenceSync(options: UsePresenceSyncOptions): UsePresenceResult {
  const {
    controller,
    store,
    sync,
    readOnly = false,
    previewing = false,
    enabled = true,
  } = options
  const muted = readOnly || previewing
  const awareness = useMemo(() => presenceAwarenessFrom(sync), [sync])
  const presence = usePresence({ awareness, enabled, readOnly: muted })
  const {
    active,
    readParticipants,
    setCursor,
    setDrag,
    setSelection,
    setTool,
    setViewport,
    subscribe,
  } = presence

  const publisher = useMemo<PresencePublisher>(
    () => ({ setCursor, setSelection, setTool, setViewport, setDrag }),
    [setCursor, setSelection, setTool, setViewport, setDrag],
  )
  const reader = useMemo<PresenceReader>(
    () => ({ readParticipants, subscribe }),
    [readParticipants, subscribe],
  )

  useEffect(() => {
    if (!controller || !active) return
    return attachPresencePublisher({
      canvas: controller,
      scene: store,
      publisher,
      readOnly: muted,
    })
  }, [active, controller, muted, publisher, store])

  useEffect(() => {
    if (!controller || !active) return
    return attachPresenceOverlay({
      canvas: controller,
      scene: store,
      reader,
      halos: !previewing,
    })
  }, [active, controller, previewing, reader, store])

  return presence
}
