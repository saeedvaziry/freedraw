import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  sampleColorAt,
  sceneCanvasAt,
  startCanvasEyeDropper,
  supportsNativeEyeDropper,
} from './eyedropper.js'

function stubCanvas(pixel: number[] | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 8
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 8, height: 8, right: 8, bottom: 8, x: 0, y: 0 }) as DOMRect
  canvas.getContext = vi.fn(() =>
    pixel === null
      ? null
      : { getImageData: () => ({ data: new Uint8ClampedArray(pixel) }) },
  ) as unknown as typeof canvas.getContext
  return canvas
}

afterEach(() => {
  delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
  vi.restoreAllMocks()
})

describe('supportsNativeEyeDropper', () => {
  it('reflects whether the window exposes the API', () => {
    expect(supportsNativeEyeDropper()).toBe(false)
    ;(window as unknown as { EyeDropper?: unknown }).EyeDropper = class {
      open = () => Promise.resolve({ sRGBHex: '#000000' })
    }
    expect(supportsNativeEyeDropper()).toBe(true)
  })
})

describe('sceneCanvasAt', () => {
  it('picks the canvas underneath the topmost overlay canvas', () => {
    const overlay = stubCanvas([0, 0, 0, 255])
    const scene = stubCanvas([1, 1, 1, 255])
    document.elementsFromPoint = vi.fn(() => [overlay, scene, document.body])

    expect(sceneCanvasAt(4, 4)).toBe(scene)
  })

  it('returns null when nothing canvas-like is under the pointer', () => {
    document.elementsFromPoint = vi.fn(() => [document.body])

    expect(sceneCanvasAt(4, 4)).toBeNull()
  })
})

describe('sampleColorAt', () => {
  it('maps client coordinates onto the canvas backing store', () => {
    const canvas = stubCanvas([32, 64, 96, 255])
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([32, 64, 96, 255]) }))
    canvas.getContext = vi.fn(() => ({ getImageData })) as unknown as typeof canvas.getContext
    canvas.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 16, height: 16, right: 26, bottom: 36, x: 10, y: 20 }) as DOMRect
    document.elementsFromPoint = vi.fn(() => [canvas])

    expect(sampleColorAt(14, 24)).toBe('#204060')
    expect(getImageData).toHaveBeenCalledWith(2, 2, 1, 1)
  })

  it('returns null for a fully transparent pixel', () => {
    document.elementsFromPoint = vi.fn(() => [stubCanvas([10, 20, 30, 0])])

    expect(sampleColorAt(1, 1)).toBeNull()
  })

  it('returns null when the pointer is outside the canvas', () => {
    document.elementsFromPoint = vi.fn(() => [stubCanvas([10, 20, 30, 255])])

    expect(sampleColorAt(-5, 1)).toBeNull()
  })

  it('returns null when no 2d context is available', () => {
    document.elementsFromPoint = vi.fn(() => [stubCanvas(null)])

    expect(sampleColorAt(1, 1)).toBeNull()
  })
})

describe('startCanvasEyeDropper', () => {
  it('reports the sampled colour on pointer down and stops listening', () => {
    document.elementsFromPoint = vi.fn(() => [stubCanvas([224, 49, 49, 255])])
    const onPick = vi.fn()
    const onCancel = vi.fn()
    startCanvasEyeDropper({ onPick, onCancel })

    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1 }))
    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1 }))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith('#e03131')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('previews the colour under the moving pointer', () => {
    document.elementsFromPoint = vi.fn(() => [stubCanvas([255, 255, 255, 255])])
    const onPreview = vi.fn()
    const session = startCanvasEyeDropper({ onPick: vi.fn(), onPreview })

    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 1, clientY: 1 }))

    expect(onPreview).toHaveBeenCalledWith('#ffffff')
    session.cancel()
  })

  it('cancels once on Escape and on an explicit cancel', () => {
    document.elementsFromPoint = vi.fn(() => [])
    const onCancel = vi.fn()
    const session = startCanvasEyeDropper({ onPick: vi.fn(), onCancel })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    session.cancel()

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels when the pointer lands off the canvas', () => {
    document.elementsFromPoint = vi.fn(() => [])
    const onPick = vi.fn()
    const onCancel = vi.fn()
    startCanvasEyeDropper({ onPick, onCancel })

    window.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1 }))

    expect(onPick).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
