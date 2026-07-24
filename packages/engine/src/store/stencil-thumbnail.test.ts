import { afterEach, describe, expect, it, vi } from 'vitest'
import { createShape } from '../model/factory.js'
import { defaultAppState } from '../model/schema.js'
import type { SceneSnapshot } from '../model/types.js'
import { buildStencilFromSelection, renderStencilThumbnail } from './stencil-thumbnail.js'

interface FakeCanvas {
  width: number
  height: number
  getContext(): CanvasRenderingContext2D | null
  toDataURL(): string
}

const DATA_URL = 'data:image/png;base64,stub'

function fakeContext(): CanvasRenderingContext2D {
  const noop = (): void => {}
  const target: Record<string, unknown> = {
    getImageData: () => ({ data: [0, 0, 0, 255] }),
  }
  return new Proxy(target, {
    get: (obj, key) => (key in obj ? obj[key as string] : noop),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D
}

function stubDocument(): FakeCanvas[] {
  const created: FakeCanvas[] = []
  vi.stubGlobal('document', {
    createElement: (): FakeCanvas => {
      const canvas: FakeCanvas = {
        width: 0,
        height: 0,
        getContext: () => fakeContext(),
        toDataURL: () => DATA_URL,
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

describe('renderStencilThumbnail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a png data url for a real selection', () => {
    stubDocument()
    expect(renderStencilThumbnail(sceneWith(100, 60), ['a'])).toBe(DATA_URL)
  })

  it('returns null when the selection is empty', () => {
    stubDocument()
    expect(renderStencilThumbnail(emptyScene(), [])).toBeNull()
  })

  it('returns null when the render target is too large', () => {
    const created = stubDocument()
    expect(renderStencilThumbnail(sceneWith(9000, 9000), ['a'], { scale: 3 })).toBeNull()
    expect(created).toHaveLength(0)
  })
})

describe('buildStencilFromSelection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null for an empty selection', () => {
    stubDocument()
    expect(buildStencilFromSelection(emptyScene(), [])).toBeNull()
  })

  it('builds a stencil with a payload and thumbnail for a real selection', () => {
    stubDocument()
    const stencil = buildStencilFromSelection(sceneWith(120, 80), ['a'], { name: 'Card' })
    expect(stencil).not.toBeNull()
    if (!stencil) return
    expect(stencil.name).toBe('Card')
    expect(stencil.kind).toBe('stencil')
    expect(stencil.payload.elements.length).toBeGreaterThan(0)
    expect(stencil.thumbnail).toBe(DATA_URL)
  })

  it('still builds a stencil when the thumbnail cannot be rendered', () => {
    stubDocument()
    const stencil = buildStencilFromSelection(sceneWith(13000, 13000), ['a'], { name: 'Big' })
    expect(stencil).not.toBeNull()
    if (!stencil) return
    expect(stencil.payload.elements.length).toBeGreaterThan(0)
    expect(stencil.thumbnail).toBeUndefined()
  })
})
