import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShape, type CameraState, type Element, type ToolId } from '@freedraw/engine'
import {
  createPresenceWriter,
  readPresenceParticipants,
  resolvePresenceIdentity,
  type PresenceAwareness,
  type PresenceParticipant,
} from '@/lib/presence'
import type { PageSync } from '@/lib/persistence'
import {
  attachPresenceOverlay,
  attachPresencePublisher,
  presenceAwarenessFrom,
  type PresenceCanvas,
  type PresencePublisher,
  type PresenceReader,
  type PresenceScene,
} from './use-presence-sync.js'

const NOW = 1_000_000

interface FakeCanvas extends PresenceCanvas {
  overlays: Array<{ cursors: number; halos: number } | null>
  cursorSubscribers: number
  cameraSubscribers: number
  moveCursor(point: { x: number; y: number } | null): void
  moveCamera(camera: CameraState): void
}

function createCanvas(camera: CameraState = { x: 0, y: 0, zoom: 1 }): FakeCanvas {
  const cursorListeners = new Set<(point: { x: number; y: number } | null) => void>()
  const cameraListeners = new Set<(camera: CameraState) => void>()
  let current = camera
  let world: { x: number; y: number } | null = null

  return {
    overlays: [],
    get cursorSubscribers() {
      return cursorListeners.size
    },
    get cameraSubscribers() {
      return cameraListeners.size
    },
    get cursorWorldPoint() {
      return world
    },
    viewportSize: { width: 800, height: 600 },
    getViewport: () => current,
    setPresenceOverlay(presence) {
      this.overlays.push(
        presence === null
          ? null
          : { cursors: presence.cursors.length, halos: presence.halos.length },
      )
    },
    subscribeCursor(listener) {
      cursorListeners.add(listener)
      return () => cursorListeners.delete(listener)
    },
    subscribeCamera(listener) {
      cameraListeners.add(listener)
      return () => cameraListeners.delete(listener)
    },
    moveCursor(point) {
      world = point
      cursorListeners.forEach((listener) => listener(point))
    },
    moveCamera(next) {
      current = next
      cameraListeners.forEach((listener) => listener(next))
    },
  }
}

interface FakeScene extends PresenceScene {
  sceneSubscribers: number
  setElements(elements: Element[]): void
  select(ids: string[]): void
  setTool(tool: ToolId): void
}

function createScene(elements: Element[] = []): FakeScene {
  const sceneListeners = new Set<() => void>()
  const selectionListeners = new Set<() => void>()
  const chromeListeners = new Set<() => void>()
  const index = (list: Element[]): Record<string, Element> =>
    Object.fromEntries(list.map((element) => [element.id, element]))
  let snapshot = { elements: index(elements) }
  let ui: { selectedIds: ReadonlySet<string>; activeTool: ToolId } = {
    selectedIds: new Set<string>(),
    activeTool: 'select',
  }

  return {
    get sceneSubscribers() {
      return sceneListeners.size
    },
    getSnapshot: () => snapshot,
    getUiState: () => ui,
    subscribe(listener) {
      sceneListeners.add(listener)
      return () => sceneListeners.delete(listener)
    },
    subscribeSelection(listener) {
      selectionListeners.add(listener)
      return () => selectionListeners.delete(listener)
    },
    subscribeChrome(listener) {
      chromeListeners.add(listener)
      return () => chromeListeners.delete(listener)
    },
    setElements(list) {
      snapshot = { elements: index(list) }
      sceneListeners.forEach((listener) => listener())
    },
    select(ids) {
      ui = { ...ui, selectedIds: new Set(ids) }
      selectionListeners.forEach((listener) => listener())
    },
    setTool(tool) {
      ui = { ...ui, activeTool: tool }
      chromeListeners.forEach((listener) => listener())
    },
  }
}

function createPublisher(): PresencePublisher & {
  cursors: Array<{ x: number; y: number } | null>
  selections: string[][]
  tools: Array<ToolId | null>
  viewports: number[]
} {
  return {
    cursors: [],
    selections: [],
    tools: [],
    viewports: [],
    setCursor(point) {
      this.cursors.push(point === null ? null : { x: point.x, y: point.y })
    },
    setSelection(ids) {
      this.selections.push([...ids])
    },
    setTool(tool) {
      this.tools.push(tool)
    },
    setViewport(viewport) {
      this.viewports.push(viewport === null ? -1 : viewport.zoom)
    },
  }
}

interface FakeReader extends PresenceReader {
  emit(participants: PresenceParticipant[]): void
  subscribers: number
}

function createReader(initial: PresenceParticipant[] = []): FakeReader {
  const listeners = new Set<() => void>()
  let participants = initial

  return {
    get subscribers() {
      return listeners.size
    },
    readParticipants: () => participants,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit(next) {
      participants = next
      listeners.forEach((listener) => listener())
    },
  }
}

function participant(
  clientId: number,
  overrides: Partial<PresenceParticipant> = {},
): PresenceParticipant {
  return {
    clientId,
    isLocal: false,
    user: resolvePresenceIdentity({ user: { id: clientId, name: `Peer ${clientId}` } }),
    cursor: null,
    selection: [],
    tool: null,
    viewport: null,
    drag: null,
    updatedAt: NOW,
    ...overrides,
  }
}

function shape(id: string, x: number): Element {
  return createShape({ id, x, y: 0, width: 10, height: 10 })
}

function fakeSync(extra: Record<string, unknown> = {}): PageSync {
  return {
    flush: () => Promise.resolve(),
    destroy: () => undefined,
    getStatus: () => 'saved',
    subscribe: () => () => undefined,
    ...extra,
  } as PageSync
}

function fakeAwareness(): Record<string, unknown> {
  return {
    clientID: 7,
    getLocalState: () => null,
    setLocalState: () => undefined,
    setLocalStateField: () => undefined,
    getStates: () => new Map(),
    on: () => undefined,
    off: () => undefined,
  }
}

function localAwareness(clientID = 1): PresenceAwareness {
  const states = new Map<number, Record<string, unknown>>()

  return {
    clientID,
    getLocalState: () => states.get(clientID) ?? null,
    setLocalState(state) {
      if (state === null) states.delete(clientID)
      else states.set(clientID, state)
    },
    setLocalStateField(field, value) {
      states.set(clientID, { ...(states.get(clientID) ?? {}), [field]: value })
    },
    getStates: () => states,
    on: () => undefined,
    off: () => undefined,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('presenceAwarenessFrom', () => {
  it('returns null without a sync', () => {
    expect(presenceAwarenessFrom(null)).toBeNull()
  })

  it('returns null for the non-collab page sync', () => {
    expect(presenceAwarenessFrom(fakeSync())).toBeNull()
  })

  it('returns null when the collab provider has no awareness', () => {
    expect(presenceAwarenessFrom(fakeSync({ awareness: null }))).toBeNull()
  })

  it('returns null when the awareness does not satisfy the presence contract', () => {
    expect(presenceAwarenessFrom(fakeSync({ awareness: { clientID: 1 } }))).toBeNull()
  })

  it('returns the awareness the collab provider owns', () => {
    const awareness = fakeAwareness()

    expect(presenceAwarenessFrom(fakeSync({ awareness }))).toBe(awareness)
  })
})

describe('attachPresencePublisher', () => {
  it('publishes the viewport as a world rect on attach', () => {
    const canvas = createCanvas({ x: 10, y: 20, zoom: 2 })
    const publisher = createPublisher()
    const setViewport = vi.spyOn(publisher, 'setViewport')

    attachPresencePublisher({ canvas, scene: createScene(), publisher })

    expect(setViewport).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 400,
      height: 300,
      zoom: 2,
    })
  })

  it('forwards pointer moves and the pointer leaving the canvas', () => {
    const canvas = createCanvas()
    const publisher = createPublisher()

    attachPresencePublisher({ canvas, scene: createScene(), publisher })
    canvas.moveCursor({ x: 4, y: 8 })
    canvas.moveCursor(null)

    expect(publisher.cursors).toEqual([{ x: 4, y: 8 }, null])
  })

  it('ignores repainted frames that did not move the camera', () => {
    const canvas = createCanvas({ x: 0, y: 0, zoom: 1 })
    const publisher = createPublisher()

    attachPresencePublisher({ canvas, scene: createScene(), publisher })
    canvas.moveCamera({ x: 0, y: 0, zoom: 1 })
    canvas.moveCamera({ x: 0, y: 0, zoom: 1 })

    expect(publisher.viewports).toHaveLength(1)
  })

  it('re-projects the cursor while the camera pans under a resting pointer', () => {
    const canvas = createCanvas()
    const publisher = createPublisher()

    attachPresencePublisher({ canvas, scene: createScene(), publisher })
    canvas.moveCursor({ x: 4, y: 8 })
    canvas.moveCamera({ x: 100, y: 0, zoom: 1 })

    expect(publisher.cursors).toEqual([
      { x: 4, y: 8 },
      { x: 4, y: 8 },
    ])
  })

  it('does not resurrect the cursor on camera moves after the pointer left', () => {
    const canvas = createCanvas()
    const publisher = createPublisher()

    attachPresencePublisher({ canvas, scene: createScene(), publisher })
    canvas.moveCursor({ x: 4, y: 8 })
    canvas.moveCursor(null)
    canvas.moveCamera({ x: 100, y: 0, zoom: 1 })

    expect(publisher.cursors).toEqual([{ x: 4, y: 8 }, null])
  })

  it('publishes the selection and the active tool while editing', () => {
    const canvas = createCanvas()
    const scene = createScene()
    const publisher = createPublisher()

    attachPresencePublisher({ canvas, scene, publisher })
    scene.select(['a', 'b'])
    scene.setTool('shape')

    expect(publisher.selections).toEqual([['a', 'b']])
    expect(publisher.tools).toEqual(['select', 'shape'])
  })

  it('skips selection updates that changed nothing', () => {
    const canvas = createCanvas()
    const scene = createScene()
    const publisher = createPublisher()

    attachPresencePublisher({ canvas, scene, publisher })
    scene.select(['a'])
    scene.select(['a'])

    expect(publisher.selections).toEqual([['a']])
  })

  it('keeps a read-only viewer to cursor and viewport only', () => {
    const canvas = createCanvas()
    const scene = createScene()
    const publisher = createPublisher()

    attachPresencePublisher({ canvas, scene, publisher, readOnly: true })
    scene.select(['a'])
    scene.setTool('shape')
    canvas.moveCursor({ x: 1, y: 2 })

    expect(publisher.selections).toEqual([[]])
    expect(publisher.tools).toEqual([null])
    expect(publisher.cursors).toEqual([{ x: 1, y: 2 }])
    expect(publisher.viewports).toHaveLength(1)
  })

  it('cannot leak selection, tool or drag through a read-only writer', () => {
    const awareness = localAwareness()
    const writer = createPresenceWriter(
      awareness,
      resolvePresenceIdentity({ user: { id: 1, name: 'Ada' } }),
      { readOnly: true },
    )
    const canvas = createCanvas()
    const scene = createScene()

    attachPresencePublisher({ canvas, scene, publisher: writer, readOnly: true })
    scene.select(['a'])
    scene.setTool('shape')
    writer.setSelection(['a'])
    writer.setTool('shape')
    writer.setDrag({ kind: 'move', frame: null })
    canvas.moveCursor({ x: 3, y: 4 })
    writer.flush()

    const local = readPresenceParticipants(awareness)[0]

    expect(local.selection).toEqual([])
    expect(local.tool).toBeNull()
    expect(local.drag).toBeNull()
    expect(local.cursor).toEqual({ x: 3, y: 4 })
    expect(local.viewport?.zoom).toBe(1)

    writer.destroy()
  })

  it('publishes selection and tool through an editable writer', () => {
    const awareness = localAwareness()
    const writer = createPresenceWriter(
      awareness,
      resolvePresenceIdentity({ user: { id: 1, name: 'Ada' } }),
    )
    const canvas = createCanvas()
    const scene = createScene()

    attachPresencePublisher({ canvas, scene, publisher: writer })
    scene.select(['a'])
    scene.setTool('shape')

    const local = readPresenceParticipants(awareness)[0]

    expect(local.selection).toEqual(['a'])
    expect(local.tool).toBe('shape')

    writer.destroy()
  })

  it('clears the local state and detaches every listener on cleanup', () => {
    const canvas = createCanvas()
    const scene = createScene()
    const publisher = createPublisher()

    const detach = attachPresencePublisher({ canvas, scene, publisher })
    scene.select(['a'])
    detach()
    scene.select(['b'])
    canvas.moveCursor({ x: 5, y: 5 })

    expect(publisher.cursors).toEqual([null])
    expect(publisher.selections).toEqual([['a'], []])
    expect(publisher.tools).toEqual(['select', null])
    expect(canvas.cursorSubscribers).toBe(0)
    expect(canvas.cameraSubscribers).toBe(0)
  })
})

describe('attachPresenceOverlay', () => {
  it('paints a remote cursor and a halo around the peer selection', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([
      participant(2, { cursor: { x: 1, y: 1 }, selection: ['a'] }),
    ])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW })

    expect(canvas.overlays).toEqual([{ cursors: 1, halos: 1 }])
  })

  it('paints no halo for a peer selecting an element this client does not have', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([
      participant(2, { cursor: { x: 1, y: 1 }, selection: ['ghost'] }),
    ])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW })

    expect(canvas.overlays).toEqual([{ cursors: 1, halos: 0 }])
  })

  it('clears the overlay when the last peer goes away', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { cursor: { x: 1, y: 1 } })])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW })
    reader.emit([])

    expect(canvas.overlays).toEqual([{ cursors: 1, halos: 0 }, null])
  })

  it('does not repaint when an awareness update changed nothing on screen', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const peer = participant(2, { cursor: { x: 1, y: 1 }, selection: ['a'] })
    const reader = createReader([peer])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW })
    reader.emit([{ ...peer, viewport: { x: 0, y: 0, width: 1, height: 1, zoom: 1 } }])

    expect(canvas.overlays).toHaveLength(1)
  })

  it('repaints the halo when the underlying element moves', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { selection: ['a'] })])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW })
    scene.setElements([shape('a', 500)])

    expect(canvas.overlays).toEqual([
      { cursors: 0, halos: 1 },
      { cursors: 0, halos: 1 },
    ])
  })

  it('drops stale peers', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([
      participant(2, { cursor: { x: 1, y: 1 }, selection: ['a'], updatedAt: NOW - 5_000 }),
    ])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW, ttlMs: 1_000 })

    expect(canvas.overlays).toEqual([null])
  })

  it('ignores the local participant', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([
      participant(2, { isLocal: true, cursor: { x: 1, y: 1 }, selection: ['a'] }),
    ])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW })

    expect(canvas.overlays).toEqual([null])
  })

  it('drops a peer that goes silent once the ttl elapses', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { cursor: { x: 1, y: 1 }, selection: ['a'] })])
    let clock = NOW

    attachPresenceOverlay({ canvas, scene, reader, now: () => clock, ttlMs: 1_000 })

    expect(canvas.overlays).toEqual([{ cursors: 1, halos: 1 }])

    clock = NOW + 1_001
    vi.advanceTimersByTime(1_001)

    expect(canvas.overlays).toEqual([{ cursors: 1, halos: 1 }, null])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('arms no sweep timer when no peer is heading for the ttl', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { isLocal: true, cursor: { x: 1, y: 1 } })])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW, ttlMs: 1_000 })

    expect(vi.getTimerCount()).toBe(0)

    reader.emit([])

    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops sweeping once every peer has expired', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([
      participant(2, { cursor: { x: 1, y: 1 } }),
      participant(3, { cursor: { x: 2, y: 2 }, updatedAt: NOW + 500 }),
    ])
    let clock = NOW
    const advance = (ms: number): void => {
      clock += ms
      vi.advanceTimersByTime(ms)
    }

    attachPresenceOverlay({ canvas, scene, reader, now: () => clock, ttlMs: 1_000 })
    advance(1_001)

    expect(canvas.overlays).toEqual([{ cursors: 2, halos: 0 }, { cursors: 1, halos: 0 }])
    expect(vi.getTimerCount()).toBe(1)

    advance(500)

    expect(canvas.overlays).toEqual([{ cursors: 2, halos: 0 }, { cursors: 1, halos: 0 }, null])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('pushes the sweep back while a peer keeps publishing', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { cursor: { x: 1, y: 1 } })])
    let clock = NOW
    const advance = (ms: number): void => {
      clock += ms
      vi.advanceTimersByTime(ms)
    }

    attachPresenceOverlay({ canvas, scene, reader, now: () => clock, ttlMs: 1_000 })
    advance(900)
    reader.emit([participant(2, { cursor: { x: 2, y: 2 }, updatedAt: clock })])
    advance(900)

    expect(canvas.overlays).toEqual([
      { cursors: 1, halos: 0 },
      { cursors: 1, halos: 0 },
    ])
    expect(vi.getTimerCount()).toBe(1)
  })

  it('cancels the pending sweep on cleanup', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { cursor: { x: 1, y: 1 } })])

    const detach = attachPresenceOverlay({
      canvas,
      scene,
      reader,
      now: () => NOW,
      ttlMs: 1_000,
    })

    expect(vi.getTimerCount()).toBe(1)

    detach()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('suspends peer halos while a version preview owns the scene', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { cursor: { x: 1, y: 1 }, selection: ['a'] })])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW, halos: false })

    expect(canvas.overlays).toEqual([{ cursors: 1, halos: 0 }])
  })

  it('paints nothing while previewing when peers only share a selection', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { selection: ['a'] })])

    attachPresenceOverlay({ canvas, scene, reader, now: () => NOW, halos: false })

    expect(canvas.overlays).toEqual([null])
  })

  it('clears the overlay and detaches every listener on cleanup', () => {
    const canvas = createCanvas()
    const scene = createScene([shape('a', 0)])
    const reader = createReader([participant(2, { cursor: { x: 1, y: 1 } })])

    const detach = attachPresenceOverlay({ canvas, scene, reader, now: () => NOW })
    detach()
    reader.emit([participant(3, { cursor: { x: 2, y: 2 } })])

    expect(canvas.overlays).toEqual([{ cursors: 1, halos: 0 }, null])
    expect(reader.subscribers).toBe(0)
    expect(scene.sceneSubscribers).toBe(0)
  })
})
