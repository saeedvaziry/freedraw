import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as Y from 'yjs'
import { arrowRoute } from '../connectors/resolve.js'
import { fitCamera } from '../geometry/fit.js'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement, Point } from '../model/types.js'
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

function dispatchPointer(canvas: HTMLCanvasElement, type: string, point: Point): void {
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
  }
  for (const handler of [...(listeners.get(type) ?? [])]) handler(event)
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
  vi.stubGlobal('window', {
    devicePixelRatio: 1,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    matchMedia: () => mediaQuery,
  })
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
  let overlayCanvas: HTMLCanvasElement
  let cleanup: (() => void) | null = null

  function mountWith(seeded: SceneStore): void {
    store = seeded
    overlayCanvas = fakeCanvas()
    cleanup = new EditorController(seeded, fakeCanvas(), overlayCanvas).mount()
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
