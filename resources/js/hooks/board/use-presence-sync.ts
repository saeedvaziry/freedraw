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
} from '@freedraw/engine'
import {
  createPresenceOverlayMapper,
  isEmptyPresenceOverlay,
  samePresenceOverlay,
  type PresenceAwareness,
  type PresenceParticipant,
  type PresencePoint,
  type PresenceViewport,
} from '@/lib/presence'
import type { PageSync } from '@/lib/persistence'
import { usePresence, type UsePresenceResult } from './use-presence.js'

const NO_SELECTION: readonly string[] = []

export interface PresenceCanvas {
  subscribeCursor(listener: (point: PresencePoint | null) => void): () => void
  subscribeCamera(listener: (camera: CameraState) => void): () => void
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
    }
  }
}

export function attachPresenceOverlay(options: AttachPresenceOverlayOptions): () => void {
  const { canvas, scene, reader, now = Date.now, ttlMs } = options
  const mapper = createPresenceOverlayMapper()
  let painted: PresenceOverlay | null = null

  const resolveFrame = (ids: readonly string[]): SelectionFrame | null => {
    const { elements } = scene.getSnapshot()
    const found: Element[] = []
    for (const id of ids) {
      const element = elements[id]
      if (element) found.push(element)
    }
    return found.length === 0 ? null : selectionFrameFor(found)
  }

  const render = (): void => {
    const next = mapper.build(reader.readParticipants(), {
      resolveFrame,
      scene: scene.getSnapshot(),
      now: now(),
      ttlMs,
    })
    if (painted !== null && samePresenceOverlay(painted, next)) return
    painted = next
    canvas.setPresenceOverlay(isEmptyPresenceOverlay(next) ? null : next)
  }

  const cleanups = [reader.subscribe(render), scene.subscribe(render)]
  render()

  return () => {
    cleanups.forEach((cleanup) => cleanup())
    canvas.setPresenceOverlay(null)
  }
}

export interface UsePresenceSyncOptions {
  controller: EditorController | null
  store: SceneStore
  sync: PageSync | null
  readOnly?: boolean
  enabled?: boolean
}

export function usePresenceSync(options: UsePresenceSyncOptions): UsePresenceResult {
  const { controller, store, sync, readOnly = false, enabled = true } = options
  const awareness = useMemo(() => presenceAwarenessFrom(sync), [sync])
  const presence = usePresence({ awareness, enabled })
  const { active, readParticipants, setCursor, setSelection, setTool, setViewport, subscribe } =
    presence

  const publisher = useMemo<PresencePublisher>(
    () => ({ setCursor, setSelection, setTool, setViewport }),
    [setCursor, setSelection, setTool, setViewport],
  )
  const reader = useMemo<PresenceReader>(
    () => ({ readParticipants, subscribe }),
    [readParticipants, subscribe],
  )

  useEffect(() => {
    if (!controller || !active) return
    return attachPresencePublisher({ canvas: controller, scene: store, publisher, readOnly })
  }, [active, controller, publisher, readOnly, store])

  useEffect(() => {
    if (!controller || !active) return
    return attachPresenceOverlay({ canvas: controller, scene: store, reader })
  }, [active, controller, reader, store])

  return presence
}
