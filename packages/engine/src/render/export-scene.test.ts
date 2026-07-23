import { afterEach, describe, expect, it, vi } from 'vitest'
import { createShape } from '../model/factory.js'
import { defaultAppState } from '../model/schema.js'
import type { SceneSnapshot } from '../model/types.js'
import {
  EXPORT_MAX_CANVAS_AREA,
  EXPORT_MAX_CANVAS_DIMENSION,
  maxExportScale,
  renderSceneExport,
  renderSceneToCanvas,
} from './export-scene.js'

interface FakeCanvas {
  width: number
  height: number
  getContext(): CanvasRenderingContext2D | null
}

function fakeContext(alpha: number): CanvasRenderingContext2D {
  const noop = (): void => {}
  const target: Record<string, unknown> = {
    getImageData: () => ({ data: [0, 0, 0, alpha] }),
  }
  return new Proxy(target, {
    get: (obj, key) => (key in obj ? obj[key as string] : noop),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D
}

function stubDocument(options: { alpha?: number; context?: boolean } = {}): FakeCanvas[] {
  const created: FakeCanvas[] = []
  vi.stubGlobal('document', {
    createElement: (): FakeCanvas => {
      const canvas: FakeCanvas = {
        width: 0,
        height: 0,
        getContext: () => (options.context === false ? null : fakeContext(options.alpha ?? 255)),
      }
      created.push(canvas)
      return canvas
    },
  })
  return created
}

function sceneWith(width: number, height: number): SceneSnapshot {
  const shape = createShape({ id: 'a', x: 0, y: 0, width, height })
  return { elements: { a: shape }, order: ['a'], appState: defaultAppState() }
}

const emptyScene = (): SceneSnapshot => ({ elements: {}, order: [], appState: defaultAppState() })

describe('maxExportScale', () => {
  it('is bound by the max dimension for long thin content', () => {
    expect(maxExportScale(EXPORT_MAX_CANVAS_DIMENSION, 10)).toBeCloseTo(1)
    expect(maxExportScale(EXPORT_MAX_CANVAS_DIMENSION / 2, 10)).toBeCloseTo(2)
  })

  it('is bound by the max area for square content', () => {
    const side = Math.sqrt(EXPORT_MAX_CANVAS_AREA)
    expect(maxExportScale(side, side)).toBeCloseTo(1)
    expect(maxExportScale(side / 4, side / 4)).toBeCloseTo(4)
  })

  it('returns zero for degenerate content', () => {
    expect(maxExportScale(0, 100)).toBe(0)
  })
})

describe('renderSceneExport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a canvas at the requested scale', () => {
    stubDocument()
    const result = renderSceneExport(sceneWith(100, 50), { format: 'png', scale: 3, padding: 10 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.size).toMatchObject({ width: 360, height: 210, scale: 3 })
    expect(result.canvas.width).toBe(360)
    expect(result.canvas.height).toBe(210)
  })

  it('reports an empty scene', () => {
    stubDocument()
    const result = renderSceneExport(emptyScene(), { format: 'png' })
    expect(result).toEqual({ ok: false, reason: 'empty' })
  })

  it('bails before allocating when the target exceeds the canvas limits', () => {
    const created = stubDocument()
    const result = renderSceneExport(sceneWith(9000, 9000), { format: 'png', scale: 3, padding: 0 })
    expect(created).toHaveLength(0)
    expect(result.ok).toBe(false)
    if (result.ok || result.reason !== 'too-large') throw new Error('expected too-large')
    expect(result.size.scale).toBe(3)
    expect(result.size.width).toBe(27000)
    expect(Math.floor(result.size.maxScale)).toBe(1)
  })

  it('allows a lower scale for the same oversized content', () => {
    stubDocument()
    const result = renderSceneExport(sceneWith(9000, 9000), { format: 'png', scale: 1, padding: 0 })
    expect(result.ok).toBe(true)
  })

  it('never suggests a scale at or above the one that failed', () => {
    stubDocument()
    const result = renderSceneExport(sceneWith(12000, 12000), { format: 'png', scale: 2, padding: 0 })
    if (result.ok || result.reason !== 'too-large') throw new Error('expected too-large')
    expect(result.size.maxScale).toBeLessThan(2)
  })

  it('treats a canvas that cannot hold pixels as too large', () => {
    stubDocument({ alpha: 0 })
    const result = renderSceneExport(sceneWith(400, 400), { format: 'png', scale: 3, padding: 0 })
    if (result.ok || result.reason !== 'too-large') throw new Error('expected too-large')
    expect(Math.floor(result.size.maxScale)).toBe(2)
  })

  it('reports an unsupported context', () => {
    stubDocument({ context: false })
    const result = renderSceneExport(sceneWith(100, 100), { format: 'png' })
    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })
})

describe('renderSceneToCanvas', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the canvas on success and null on failure', () => {
    stubDocument()
    expect(renderSceneToCanvas(sceneWith(100, 100), { format: 'png' })).not.toBeNull()
    expect(renderSceneToCanvas(emptyScene(), { format: 'png' })).toBeNull()
    expect(renderSceneToCanvas(sceneWith(9000, 9000), { format: 'png', scale: 3 })).toBeNull()
  })
})
