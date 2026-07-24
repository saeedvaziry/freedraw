import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fitCamera } from '../geometry/fit.js'
import { SceneStore } from '../store/scene-store.js'
import { EditorController } from './editor-controller.js'

const VIEWPORT = { width: 800, height: 600 }

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
    getContext: () => ctx,
    getBoundingClientRect: () => rect,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    hasPointerCapture: () => false,
  }
  return canvas as unknown as HTMLCanvasElement
}

function stubEnvironment(): void {
  const mediaQuery = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  vi.stubGlobal('requestAnimationFrame', () => 0)
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
