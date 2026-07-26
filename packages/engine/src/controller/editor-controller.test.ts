import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as Y from 'yjs'
import { arrowRoute } from '../connectors/resolve.js'
import { spawnConnectedShape } from '../connectors/spawn.js'
import { fitCamera } from '../geometry/fit.js'
import { resizeHandlesScreen } from '../geometry/handles.js'
import { selectionFrameFor } from '../geometry/selection-frame.js'
import { createArrow, createImage, createShape } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import type { ArrowElement, Binding, CameraState, Element, ElementId, Point } from '../model/types.js'
import type { EditRequest } from '../text/edit.js'
import { Renderer, type OverlayState } from '../render/renderer.js'
import { SceneStore } from '../store/scene-store.js'
import { EditorController } from './editor-controller.js'

const VIEWPORT = { width: 800, height: 600 }

type FakeListener = (event: unknown) => void

function fakeContext(): CanvasRenderingContext2D {
  const noop = (): void => undefined
  const state: Record<PropertyKey, unknown> = {}
  return new Proxy(state, {
    get(store, prop) {
      if (prop in store) return store[prop]
      if (prop === 'measureText') return () => ({ width: 0 })
      return noop
    },
    set(store, prop, value) {
      store[prop] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function fakeCanvas(): HTMLCanvasElement {
  const ctx = fakeContext()
  const listeners = new Map<string, FakeListener[]>()
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: VIEWPORT.width,
    bottom: VIEWPORT.height,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    toJSON: () => ({}),
  }
  const canvas = {
    width: 0,
    height: 0,
    style: {} as CSSStyleDeclaration,
    listeners,
    getContext: () => ctx,
    getBoundingClientRect: () => rect,
    addEventListener: (type: string, handler: FakeListener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler])
    },
    removeEventListener: (type: string, handler: FakeListener) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== handler))
    },
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    hasPointerCapture: () => false,
  }
  return canvas as unknown as HTMLCanvasElement
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type: string,
  point: Point,
  overrides: Record<string, unknown> = {},
): void {
  const { listeners } = canvas as unknown as { listeners: Map<string, FakeListener[]> }
  const event = {
    pointerId: 1,
    button: 0,
    clientX: point.x,
    clientY: point.y,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: () => undefined,
    stopImmediatePropagation: () => undefined,
    ...overrides,
  }
  for (const handler of [...(listeners.get(type) ?? [])]) handler(event)
}

const windowListeners = new Map<string, FakeListener[]>()

function dispatchWindow(type: string, event: Record<string, unknown>): void {
  const payload = { preventDefault: () => undefined, ...event }
  for (const handler of [...(windowListeners.get(type) ?? [])]) handler(payload)
}

let frameCallback: FrameRequestCallback | null = null

function flushFrame(): void {
  const callback = frameCallback
  frameCallback = null
  callback?.(0)
}

function stubEnvironment(): void {
  const mediaQuery = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  frameCallback = null
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameCallback = callback
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  windowListeners.clear()
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    addEventListener: (type: string, handler: FakeListener) => {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), handler])
    },
    removeEventListener: (type: string, handler: FakeListener) => {
      windowListeners.set(
        type,
        (windowListeners.get(type) ?? []).filter((entry) => entry !== handler),
      )
    },
    matchMedia: () => mediaQuery,
  })
  vi.stubGlobal('HTMLElement', class {})
  vi.stubGlobal('document', {
    fonts: { load: () => Promise.resolve([]) },
  })
}

describe('EditorController.zoomToRect', () => {
  let controller: EditorController
  let cleanup: () => void

  beforeEach(() => {
    stubEnvironment()
    controller = new EditorController(new SceneStore(), fakeCanvas(), fakeCanvas())
    cleanup = controller.mount()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('frames a world-space rect using the same fitCamera path as zoomToFit', () => {
    const rect = { x: 120, y: 240, width: 400, height: 300 }
    controller.zoomToRect(rect)
    expect(controller.getViewport()).toEqual(fitCamera(rect, VIEWPORT.width, VIEWPORT.height))
  })

  it('clamps zoom for a tiny rect the same way fitCamera does', () => {
    const rect = { x: 0, y: 0, width: 2, height: 2 }
    controller.zoomToRect(rect)
    expect(controller.getViewport().zoom).toBe(
      fitCamera(rect, VIEWPORT.width, VIEWPORT.height).zoom,
    )
  })

  it('is a no-op before the viewport has a size', () => {
    const idle = new EditorController(new SceneStore(), fakeCanvas(), fakeCanvas())
    idle.zoomToRect({ x: 0, y: 0, width: 100, height: 100 })
    expect(idle.getViewport()).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('EditorController overlay chrome during transient drags', () => {
  let renderOverlay: MockInstance<Renderer['renderOverlay']>
  let store: SceneStore
  let controller: EditorController
  let overlayCanvas: HTMLCanvasElement
  let cleanup: (() => void) | null = null

  function mountWith(seeded: SceneStore): void {
    store = seeded
    overlayCanvas = fakeCanvas()
    controller = new EditorController(seeded, fakeCanvas(), overlayCanvas)
    cleanup = controller.mount()
    renderOverlay.mockClear()
  }

  function lastOverlay(): OverlayState {
    const calls = renderOverlay.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    return calls[calls.length - 1]![1] ?? {}
  }

  function shapeScene(): SceneStore {
    const seeded = new SceneStore()
    seeded.transact((api) =>
      api.addElement(createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 120, height: 80 })),
    )
    return seeded
  }

  function pairScene(): SceneStore {
    const seeded = new SceneStore()
    seeded.transact((api) => {
      api.addElement(createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 100 }))
      api.addElement(createShape({ id: 'b', type: 'rect', x: 200, y: 0, width: 100, height: 100 }))
    })
    return seeded
  }

  beforeEach(() => {
    stubEnvironment()
    renderOverlay = vi.spyOn(Renderer.prototype, 'renderOverlay')
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('moves the selection frame and ports with a transient move preview', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    const idle = lastOverlay()
    expect(idle.selection?.bounds).toEqual({ x: 0, y: 0, width: 120, height: 80 })
    expect(idle.ports?.[0]).toBe(store.getSnapshot().elements['a'])

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 60, y: 40 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 110, y: 40 })
    flushFrame()

    const dragging = lastOverlay()
    expect(store.getSnapshot().elements['a']!.x).toBe(0)
    expect(dragging.transient?.[0]?.x).toBe(50)
    expect(dragging.selection?.bounds).toEqual({ x: 50, y: 0, width: 120, height: 80 })
    expect(dragging.ports?.[0]?.x).toBe(50)

    dispatchPointer(overlayCanvas, 'pointerup', { x: 110, y: 40 })
    flushFrame()

    const released = lastOverlay()
    expect(released.transient).toBeNull()
    expect(released.selection?.bounds).toEqual({ x: 50, y: 0, width: 120, height: 80 })
  })

  it('publishes the transient layer to subscribers for the whole drag', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const unsubscribe = controller.subscribeTransient((elements) => frames.push(elements))
    expect(controller.activeTransient).toBeNull()

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 60, y: 40 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 110, y: 40 })

    expect(frames.at(-1)?.[0]?.x).toBe(50)
    expect(controller.activeTransient?.[0]?.x).toBe(50)
    expect(store.getSnapshot().elements['a']!.x).toBe(0)

    dispatchPointer(overlayCanvas, 'pointermove', { x: 160, y: 40 })
    expect(frames.at(-1)?.[0]?.x).toBe(100)

    dispatchPointer(overlayCanvas, 'pointerup', { x: 160, y: 40 })
    expect(frames.at(-1)).toBeNull()
    expect(controller.activeTransient).toBeNull()

    unsubscribe()
    const seen = frames.length
    dispatchPointer(overlayCanvas, 'pointerdown', { x: 110, y: 40 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 140, y: 40 })
    expect(frames).toHaveLength(seen)
  })

  it('marks the select-tool transient layer as transient and never as preview', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const kinds: (string | undefined)[] = []
    const unsubscribe = controller.subscribeTransient((elements, kind) => {
      frames.push(elements)
      kinds.push(kind)
    })

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 60, y: 40 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 110, y: 40 })
    dispatchPointer(overlayCanvas, 'pointerup', { x: 110, y: 40 })

    expect(kinds.length).toBeGreaterThan(0)
    expect([...new Set(kinds)]).toEqual(['transient'])
    expect(frames.some((entry) => entry?.[0]?.x === 50)).toBe(true)
    expect(frames.at(-1)).toBeNull()

    unsubscribe()
  })

  it('publishes a freehand stroke on the transient channel as a preview', () => {
    mountWith(shapeScene())
    store.setUiState({ activeTool: 'freedraw' })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const kinds: (string | undefined)[] = []
    const unsubscribe = controller.subscribeTransient((elements, kind) => {
      frames.push(elements)
      kinds.push(kind)
    })

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 200, y: 200 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 260, y: 240 })

    expect(kinds.at(-1)).toBe('preview')
    expect(frames.at(-1)).toHaveLength(1)
    expect(frames.at(-1)?.[0]?.type).toBe('freedraw')
    expect(controller.activeTransient).toBeNull()

    dispatchPointer(overlayCanvas, 'pointerup', { x: 260, y: 240 })

    expect(frames.at(-1)).toBeNull()
    expect(kinds.at(-1)).toBe('preview')
    expect(store.getSnapshot().order).toHaveLength(2)

    unsubscribe()
  })

  it('publishes a creation ghost on the transient channel as a preview', () => {
    mountWith(shapeScene())
    store.setUiState({ activeTool: 'shape' })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const kinds: (string | undefined)[] = []
    const unsubscribe = controller.subscribeTransient((elements, kind) => {
      frames.push(elements)
      kinds.push(kind)
    })

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 300, y: 300 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 400, y: 380 })

    expect(kinds.at(-1)).toBe('preview')
    expect(frames.at(-1)?.[0]?.width).toBe(100)
    expect(frames.at(-1)?.[0]?.height).toBe(80)

    unsubscribe()
  })

  it('keeps a hovered shape placement ghost off the transient channel', () => {
    mountWith(shapeScene())
    store.setUiState({ activeTool: 'shape' })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const unsubscribe = controller.subscribeTransient((elements) => frames.push(elements))

    dispatchPointer(overlayCanvas, 'pointermove', { x: 300, y: 300 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 340, y: 320 })

    expect(frames).toHaveLength(0)

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 340, y: 320 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 420, y: 400 })

    expect(frames.at(-1)?.[0]).toBeDefined()

    unsubscribe()
  })

  it('keeps a hovered sticky placement ghost off the transient channel', () => {
    mountWith(shapeScene())
    store.setUiState({ activeTool: 'sticky' })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const unsubscribe = controller.subscribeTransient((elements) => frames.push(elements))

    dispatchPointer(overlayCanvas, 'pointermove', { x: 300, y: 300 })

    expect(frames).toHaveLength(0)

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 300, y: 300 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 380, y: 360 })

    expect(frames.at(-1)?.[0]).toBeDefined()

    unsubscribe()
  })

  it('clears a shared creation preview when the tool falls back to hovering', () => {
    mountWith(shapeScene())
    store.setUiState({ activeTool: 'shape' })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const unsubscribe = controller.subscribeTransient((elements) => frames.push(elements))

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 300, y: 300 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 400, y: 380 })
    dispatchPointer(overlayCanvas, 'pointerup', { x: 400, y: 380 })

    expect(frames.at(-1)).toBeNull()

    const seen = frames.length
    dispatchPointer(overlayCanvas, 'pointermove', { x: 460, y: 420 })

    expect(frames).toHaveLength(seen)

    unsubscribe()
  })

  it('emits a single clear when a creation preview is dismissed more than once', () => {
    mountWith(shapeScene())
    store.setUiState({ activeTool: 'freedraw' })
    flushFrame()

    const frames: (readonly Element[] | null)[] = []
    const unsubscribe = controller.subscribeTransient((elements) => frames.push(elements))

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 200, y: 200 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 260, y: 240 })
    dispatchPointer(overlayCanvas, 'pointerup', { x: 260, y: 240 })

    const seen = frames.length
    expect(frames.at(-1)).toBeNull()

    store.setUiState({ activeTool: 'select' })

    expect(frames).toHaveLength(seen)

    unsubscribe()
  })

  it('grows the selection frame with a transient resize preview', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 120, y: 80 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 200, y: 160 })
    flushFrame()

    const dragging = lastOverlay()
    expect(store.getSnapshot().elements['a']!.width).toBe(120)
    expect(dragging.selection?.bounds.width).toBe(200)
    expect(dragging.selection?.bounds.height).toBe(160)
  })

  it('rotates the selection frame with a transient rotate preview', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 60, y: -48 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 100, y: -48 })
    flushFrame()

    const dragging = lastOverlay()
    expect(store.getSnapshot().elements['a']!.rotation).toBe(0)
    expect(dragging.selection?.rotation).not.toBe(0)
  })

  it('spins a multi-select rotate frame rigidly instead of remeasuring it', () => {
    mountWith(pairScene())
    store.setUiState({ selectedIds: new Set(['a', 'b']) })
    flushFrame()

    expect(lastOverlay().selection?.bounds).toEqual({ x: 0, y: 0, width: 300, height: 100 })

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 150, y: -48 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 250, y: 50 })
    flushFrame()

    const quarter = lastOverlay().selection
    expect(quarter?.bounds.width).toBeCloseTo(300, 6)
    expect(quarter?.bounds.height).toBeCloseTo(100, 6)
    expect(quarter?.rotation).toBeCloseTo(Math.PI / 2, 6)
    expect(quarter?.center.x).toBeCloseTo(150, 6)
    expect(quarter?.center.y).toBeCloseTo(50, 6)

    dispatchPointer(overlayCanvas, 'pointermove', { x: 150, y: 150 })
    flushFrame()

    const half = lastOverlay().selection
    expect(half?.bounds.width).toBeCloseTo(300, 6)
    expect(half?.bounds.height).toBeCloseTo(100, 6)
    expect(half?.rotation).toBeCloseTo(Math.PI, 6)

    dispatchPointer(overlayCanvas, 'pointerup', { x: 150, y: 150 })
    flushFrame()

    const released = lastOverlay().selection
    expect(store.getSnapshot().elements['a']!.rotation).toBeCloseTo(Math.PI, 6)
    expect(released?.rotation).toBeCloseTo(Math.PI, 6)
    expect(released?.bounds.width).toBeCloseTo(300, 6)
    expect(released?.bounds.height).toBeCloseTo(100, 6)
  })

  it('moves the arrow handles with a transient endpoint preview', () => {
    const seeded = new SceneStore()
    seeded.transact((api) =>
      api.addElement(
        createArrow({ id: 'arrow', points: [{ x: 200, y: 200 }, { x: 300, y: 200 }] }),
      ),
    )
    mountWith(seeded)
    store.setUiState({ selectedIds: new Set(['arrow']) })
    flushFrame()

    expect(arrowRoute(lastOverlay().selectedArrows![0]!).at(-1)).toEqual({ x: 300, y: 200 })

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 300, y: 200 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 400, y: 200 })
    flushFrame()

    const dragging = lastOverlay()
    expect(arrowRoute(store.getSnapshot().elements['arrow'] as ArrowElement).at(-1)).toEqual({
      x: 300,
      y: 200,
    })
    expect(arrowRoute(dragging.selectedArrows![0]!).at(-1)).toEqual({ x: 400, y: 200 })
  })

  it('paints no chrome for a transient element that is not in the scene', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 140, y: 40 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 220, y: 40 })
    expect(() => flushFrame()).not.toThrow()

    const dragging = lastOverlay()
    const previewed = dragging.transient?.find((element) => element.type === 'arrow')
    expect(previewed).toBeDefined()
    expect(store.getSnapshot().elements[previewed!.id]).toBeUndefined()
    expect(dragging.selectedArrows ?? []).toHaveLength(0)
    expect(dragging.selection?.bounds).toEqual({ x: 0, y: 0, width: 120, height: 80 })
    expect(dragging.ports?.map((element) => element.id)).toEqual(['a'])
  })

  it('keeps the chrome on the preview when the dragged element is deleted remotely', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 60, y: 40 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 110, y: 40 })

    const remote = new SceneStore()
    Y.applyUpdate(remote.doc, Y.encodeStateAsUpdate(store.doc))
    remote.transact((api) => api.removeElements(['a']))
    Y.applyUpdate(store.doc, Y.encodeStateAsUpdate(remote.doc), 'remote-peer')

    expect(store.getSnapshot().elements['a']).toBeUndefined()
    expect(store.getUiState().selectedIds.has('a')).toBe(true)
    expect(() => flushFrame()).not.toThrow()

    const dragging = lastOverlay()
    expect(dragging.transient?.[0]?.id).toBe('a')
    expect(dragging.selection?.bounds).toEqual({ x: 50, y: 0, width: 120, height: 80 })
  })
})

describe('EditorController locked badges', () => {
  let renderOverlay: MockInstance<Renderer['renderOverlay']>
  let cleanup: (() => void) | null = null

  function mountWith(seeded: SceneStore): HTMLCanvasElement {
    const overlayCanvas = fakeCanvas()
    cleanup = new EditorController(seeded, fakeCanvas(), overlayCanvas).mount()
    renderOverlay.mockClear()
    return overlayCanvas
  }

  function lastOverlay(): OverlayState {
    const calls = renderOverlay.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    return calls[calls.length - 1]![1] ?? {}
  }

  beforeEach(() => {
    stubEnvironment()
    renderOverlay = vi.spyOn(Renderer.prototype, 'renderOverlay')
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reports every locked element in view without requiring selection or hover', () => {
    const store = new SceneStore()
    mountWith(store)
    store.transact((api) => {
      api.addElement(createShape({ id: 'free', type: 'rect', x: 0, y: 0, width: 40, height: 40 }))
      api.addElement(createShape({ id: 'locked', type: 'rect', x: 60, y: 0, width: 40, height: 40 }))
    })
    store.lockElements(['locked'])
    flushFrame()

    const overlay = lastOverlay()
    expect(overlay.lockedBadges?.map((element) => element.id)).toEqual(['locked'])
    expect(overlay.selection ?? null).toBeNull()
    expect(overlay.hover ?? null).toBeNull()
  })

  it('culls locked elements outside the viewport', () => {
    const store = new SceneStore()
    mountWith(store)
    store.transact((api) => {
      api.addElement(createShape({ id: 'near', type: 'rect', x: 0, y: 0, width: 40, height: 40 }))
      api.addElement(
        createShape({ id: 'far', type: 'rect', x: 100_000, y: 100_000, width: 40, height: 40 }),
      )
    })
    store.lockElements(['near', 'far'])
    flushFrame()

    expect(lastOverlay().lockedBadges?.map((element) => element.id)).toEqual(['near'])
  })

  it('drops the badge when an element is unlocked', () => {
    const store = new SceneStore()
    mountWith(store)
    store.transact((api) =>
      api.addElement(createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40 })),
    )
    store.lockElements(['a'])
    flushFrame()
    expect(lastOverlay().lockedBadges).toHaveLength(1)

    store.unlockElements(['a'])
    flushFrame()

    expect(lastOverlay().lockedBadges).toHaveLength(0)
  })

  it('reuses the cached list across overlay frames when the scene is unchanged', () => {
    const store = new SceneStore()
    mountWith(store)
    store.transact((api) =>
      api.addElement(createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40 })),
    )
    flushFrame()
    const first = lastOverlay().lockedBadges

    store.setUiState({ selectedIds: new Set(['a']) })
    flushFrame()

    expect(first).toHaveLength(0)
    expect(lastOverlay().lockedBadges).toBe(first)
  })
})

describe('EditorController edit liveness', () => {
  let store: SceneStore
  let controller: EditorController
  let cleanup: (() => void) | null = null

  function seedShape(id: string): void {
    store.transact((api) =>
      api.addElement(createShape({ id, type: 'rect', x: 0, y: 0, width: 120, height: 80 })),
    )
    store.stopCapturing()
  }

  beforeEach(() => {
    stubEnvironment()
    store = new SceneStore()
    controller = new EditorController(store, fakeCanvas(), fakeCanvas())
    cleanup = controller.mount()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
    vi.unstubAllGlobals()
  })

  it('ends an open label edit when undo removes the edited element', () => {
    seedShape('a')
    controller.beginLabelEditFromText('a', 'hello')
    expect(controller.activeEdit?.elementId).toBe('a')

    const seen: (EditRequest | null)[] = []
    controller.subscribeEdit((request) => seen.push(request))

    store.undo()

    expect(store.getSnapshot().elements['a']).toBeUndefined()
    expect(controller.activeEdit).toBeNull()
    expect(seen.at(-1)).toBeNull()
  })

  it('ends an open label edit when a peer deletes the edited element', () => {
    seedShape('a')
    controller.beginLabelEditFromText('a', 'hello')

    const remote = new SceneStore()
    Y.applyUpdate(remote.doc, Y.encodeStateAsUpdate(store.doc))
    remote.transact((api) => api.removeElements(['a']))
    Y.applyUpdate(store.doc, Y.encodeStateAsUpdate(remote.doc), 'remote-peer')

    expect(controller.activeEdit).toBeNull()
  })

  it('keeps the edit open when an unrelated element is removed', () => {
    seedShape('a')
    seedShape('b')
    controller.beginLabelEditFromText('a', 'hello')

    store.deleteElements(['b'])

    expect(controller.activeEdit?.elementId).toBe('a')
  })
})

describe('EditorController camera input signal', () => {
  let store: SceneStore
  let controller: EditorController
  let overlayCanvas: HTMLCanvasElement
  let emitted: CameraState[]
  let cleanup: (() => void) | null = null

  beforeEach(() => {
    stubEnvironment()
    store = new SceneStore()
    overlayCanvas = fakeCanvas()
    controller = new EditorController(store, fakeCanvas(), overlayCanvas)
    cleanup = controller.mount()
    emitted = []
    controller.subscribeCameraInput((state) => emitted.push(state))
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
    vi.unstubAllGlobals()
  })

  it('emits while the hand tool pans', () => {
    store.setUiState({ activeTool: 'hand' })

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 100, y: 100 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 160, y: 140 })

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toEqual(controller.getViewport())
    expect(controller.getViewport()).toEqual({ x: -60, y: -40, zoom: 1 })
  })

  it('does not emit for a hand tool click that never moves', () => {
    store.setUiState({ activeTool: 'hand' })

    dispatchPointer(overlayCanvas, 'pointerdown', { x: 100, y: 100 })
    dispatchPointer(overlayCanvas, 'pointerup', { x: 100, y: 100 })

    expect(emitted).toHaveLength(0)
  })

  it('emits for zoomToFit', () => {
    store.transact((api) =>
      api.addElement(createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 200, height: 100 })),
    )

    controller.zoomToFit()

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toEqual(controller.getViewport())
  })

  it('emits for zoomToRect', () => {
    controller.zoomToRect({ x: 120, y: 240, width: 400, height: 300 })

    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toEqual(controller.getViewport())
  })

  it('emits for zoomToActualSize', () => {
    controller.zoomToRect({ x: 120, y: 240, width: 400, height: 300 })
    emitted.length = 0

    controller.zoomToActualSize()

    expect(emitted).toHaveLength(1)
    expect(controller.getViewport().zoom).toBe(1)
  })

  it('does not emit for focusViewport', () => {
    controller.focusViewport({ x: 12, y: 34, zoom: 2 })

    expect(emitted).toHaveLength(0)
    expect(controller.getViewport()).toEqual({ x: 12, y: 34, zoom: 2 })
  })
})

describe('EditorController cursor channel', () => {
  let store: SceneStore
  let controller: EditorController
  let overlayCanvas: HTMLCanvasElement
  let emitted: string[]
  let cleanup: (() => void) | null = null

  function mountWith(seeded: SceneStore): void {
    store = seeded
    overlayCanvas = fakeCanvas()
    controller = new EditorController(seeded, fakeCanvas(), overlayCanvas)
    cleanup = controller.mount()
    emitted = []
    controller.subscribeCursorStyle((cursor) => emitted.push(cursor))
  }

  function shapeScene(rotation = 0): SceneStore {
    const seeded = new SceneStore()
    seeded.transact((api) =>
      api.addElement(
        createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 120, height: 80, rotation }),
      ),
    )
    return seeded
  }

  function handleScreen(id: string): Point {
    const selected = [...store.getUiState().selectedIds]
      .map((elementId) => store.getSnapshot().elements[elementId])
      .filter(Boolean) as Element[]
    const frame = selectionFrameFor(selected)!
    return resizeHandlesScreen(frame, controller.camera).find((handle) => handle.id === id)!.position
  }

  beforeEach(() => {
    stubEnvironment()
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
    vi.unstubAllGlobals()
  })

  it('starts on the default cursor and never re-emits an unchanged one', () => {
    mountWith(shapeScene())

    dispatchPointer(overlayCanvas, 'pointermove', { x: 400, y: 400 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 420, y: 420 })

    expect(controller.activeCursorStyle).toBe('default')
    expect(emitted).toEqual([])
  })

  it('emits the draw cursor once when a creation tool becomes active', () => {
    mountWith(shapeScene())

    store.setUiState({ activeTool: 'shape' })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 400, y: 400 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 420, y: 420 })

    expect(controller.activeCursorStyle).toBe('crosshair')
    expect(emitted).toEqual(['crosshair'])
  })

  it('grabs and grabbing while the hand tool pans', () => {
    mountWith(shapeScene())

    store.setUiState({ activeTool: 'hand' })
    dispatchPointer(overlayCanvas, 'pointerdown', { x: 100, y: 100 })
    dispatchPointer(overlayCanvas, 'pointermove', { x: 160, y: 140 })
    dispatchPointer(overlayCanvas, 'pointerup', { x: 160, y: 140 })

    expect(emitted).toEqual(['grab', 'grabbing', 'grab'])
  })

  it('holds the pan cursor while space is down', () => {
    mountWith(shapeScene())

    dispatchWindow('keydown', { code: 'Space', target: null })
    expect(controller.activeCursorStyle).toBe('grab')

    dispatchWindow('keyup', { code: 'Space' })
    expect(controller.activeCursorStyle).toBe('default')
  })

  it('reports move over a selected element and default over the empty canvas', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })

    dispatchPointer(overlayCanvas, 'pointermove', { x: 60, y: 40 })
    expect(controller.activeCursorStyle).toBe('move')

    dispatchPointer(overlayCanvas, 'pointermove', { x: 400, y: 400 })
    expect(controller.activeCursorStyle).toBe('default')
  })

  it('reads a resize handle of a quarter-turned frame as the rotated direction', () => {
    mountWith(shapeScene(Math.PI / 2))
    store.setUiState({ selectedIds: new Set(['a']) })

    dispatchPointer(overlayCanvas, 'pointermove', handleScreen('n'))

    expect(controller.activeCursorStyle).toBe('ew-resize')
  })

  it('hints the unlock affordance when Alt goes down over a locked element', () => {
    mountWith(shapeScene())
    store.lockElements(['a'])

    dispatchPointer(overlayCanvas, 'pointermove', { x: 60, y: 40 })
    expect(controller.activeCursorStyle).toBe('default')

    dispatchWindow('keydown', { code: 'AltLeft', altKey: true })
    expect(controller.activeCursorStyle).toBe('pointer')

    dispatchWindow('keyup', { code: 'AltLeft', altKey: false })
    expect(controller.activeCursorStyle).toBe('default')
  })

  it('drops back to the tool cursor when the pointer leaves the canvas', () => {
    mountWith(shapeScene())
    store.setUiState({ selectedIds: new Set(['a']) })

    dispatchPointer(overlayCanvas, 'pointermove', { x: 60, y: 40 })
    expect(controller.activeCursorStyle).toBe('move')

    dispatchPointer(overlayCanvas, 'pointerleave', { x: 60, y: 40 })
    expect(controller.activeCursorStyle).toBe('default')
  })

  it('stops emitting once a listener unsubscribes', () => {
    mountWith(shapeScene())
    const seen: string[] = []
    const stop = controller.subscribeCursorStyle((cursor) => seen.push(cursor))

    store.setUiState({ activeTool: 'shape' })
    stop()
    store.setUiState({ activeTool: 'select' })

    expect(seen).toEqual(['crosshair'])
    expect(emitted).toEqual(['crosshair', 'default'])
  })
})

describe('EditorController.exportSvg image sources', () => {
  const BITMAP = { width: 40, height: 30 } as unknown as ImageBitmap
  const WEBP_BASE64 = btoa('\x01\x02\x03')
  let controller: EditorController
  let cleanup: () => void

  function webpBlob(): Blob {
    return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
  }

  function svgOf(result: Awaited<ReturnType<EditorController['exportSvg']>>): string {
    if (!result.ok) throw new Error(`expected ok svg, got ${result.reason}`)
    return result.svg
  }

  beforeEach(() => {
    stubEnvironment()
    vi.stubGlobal('createImageBitmap', () => Promise.resolve(BITMAP))
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(
        createImage({
          id: 'img',
          assetId: 'asset-1',
          x: 0,
          y: 0,
          naturalWidth: 40,
          naturalHeight: 30,
          viewportWidth: VIEWPORT.width,
          viewportHeight: VIEWPORT.height,
        }),
      ),
    )
    controller = new EditorController(store, fakeCanvas(), fakeCanvas())
    cleanup = controller.mount()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads the original asset blob and embeds it with its own mime type', async () => {
    const loadBlob = vi.fn(() => Promise.resolve(webpBlob()))
    controller.setImageBlobLoader(loadBlob)

    const svg = svgOf(await controller.exportSvg({}))

    expect(loadBlob).toHaveBeenCalledWith('asset-1')
    expect(svg).toContain(`href="data:image/webp;base64,${WEBP_BASE64}"`)
  })

  it('embeds a blob handed to cacheImageBitmap without loading the asset again', async () => {
    const loadBlob = vi.fn(() => Promise.resolve(undefined))
    controller.setImageBlobLoader(loadBlob)
    controller.cacheImageBitmap('asset-1', BITMAP, webpBlob())

    const svg = svgOf(await controller.exportSvg({}))

    expect(loadBlob).not.toHaveBeenCalled()
    expect(svg).toContain(`href="data:image/webp;base64,${WEBP_BASE64}"`)
  })

  it('fetches the source for a bitmap that was cached without one', async () => {
    const loadBlob = vi.fn(() => Promise.resolve(webpBlob()))
    controller.setImageBlobLoader(loadBlob)
    controller.cacheImageBitmap('asset-1', BITMAP)

    const svg = svgOf(await controller.exportSvg({}))

    expect(loadBlob).toHaveBeenCalledTimes(1)
    expect(svg).toContain(`href="data:image/webp;base64,${WEBP_BASE64}"`)
  })
})

describe('EditorController.spawnSiblingAndEdit binding liveness', () => {
  let store: SceneStore
  let controller: EditorController
  let childId: ElementId

  function bindingTo(elementId: ElementId): Binding {
    return { elementId, anchor: { nx: 0.5, ny: 0.5 }, gap: 8, side: 'right' }
  }

  function mount(seeded: SceneStore): void {
    store = seeded
    controller = new EditorController(seeded, fakeCanvas(), fakeCanvas())
  }

  function boundScene(): void {
    const seeded = new SceneStore()
    const parent = createShape({ id: 'parent', type: 'rect', x: 0, y: 0, width: 100, height: 60 })
    seeded.transact((api) => api.addElement(parent))
    childId = spawnConnectedShape(seeded, parent, 'right')
    mount(seeded)
  }

  function orphanScene(): void {
    const seeded = new SceneStore()
    seeded.transact((api) =>
      api.addElement(createShape({ id: 'child', type: 'rect', x: 200, y: 0, width: 100, height: 60 })),
    )
    childId = 'child'
    mount(seeded)
  }

  function prependDeadBinding(): void {
    const live = store.getSnapshot.bind(store)
    const dead = createArrow({
      id: 'dead-arrow',
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      start: bindingTo('ghost'),
      end: bindingTo(childId),
    })
    vi.spyOn(store, 'getSnapshot').mockImplementation(() => {
      const snapshot = live()
      return {
        ...snapshot,
        elements: { ...snapshot.elements, [dead.id]: dead },
        order: [dead.id, ...snapshot.order],
      }
    })
  }

  function parentOf(id: ElementId): ElementId | undefined {
    const snapshot = store.getSnapshot()
    for (const entry of snapshot.order) {
      const element = snapshot.elements[entry]
      if (!element || !isArrowElement(element)) continue
      if (element.end?.elementId === id) return element.start?.elementId
    }
    return undefined
  }

  beforeEach(() => {
    stubEnvironment()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('spawns the sibling against the parent a live binding points at', () => {
    boundScene()

    const siblingId = controller.spawnSiblingAndEdit(childId)

    expect(siblingId).not.toBeNull()
    expect(parentOf(siblingId!)).toBe('parent')
  })

  it('spawns nothing when the only binding points at an element missing from the snapshot', () => {
    orphanScene()
    prependDeadBinding()
    const before = store.getSnapshot().order.length

    expect(controller.spawnSiblingAndEdit(childId)).toBeNull()
    expect(store.getSnapshot().order.length).toBe(before)
  })

  it('keeps resolving past a dead binding to the parent that is still in the snapshot', () => {
    boundScene()
    prependDeadBinding()

    const siblingId = controller.spawnSiblingAndEdit(childId)

    expect(siblingId).not.toBeNull()
    expect(parentOf(siblingId!)).toBe('parent')
  })
})
