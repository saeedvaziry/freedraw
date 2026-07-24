import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImageCache } from '../assets/image-cache.js'
import { createImage, createShape, createSticky, createText } from '../model/factory.js'
import { defaultAppState } from '../model/schema.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { clearDrawCaches } from './draw-cache.js'
import { renderSceneSvg } from './export-scene.js'
import { invertColor } from './invert.js'
import { setImageCache } from './painters/image.js'

function sceneWith(...elements: Element[]): SceneSnapshot {
  const map: Record<string, Element> = {}
  const order: string[] = []
  for (const element of elements) {
    map[element.id] = element
    order.push(element.id)
  }
  return { elements: map, order, appState: defaultAppState() }
}

function svgOf(snapshot: SceneSnapshot, options = {}): string {
  const result = renderSceneSvg(snapshot, options)
  if (!result.ok) throw new Error(`expected ok svg, got ${result.reason}`)
  return result.svg
}

describe('renderSceneSvg', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setImageCache(null)
    clearDrawCaches()
  })

  it('reports an empty scene', () => {
    const result = renderSceneSvg({ elements: {}, order: [], appState: defaultAppState() }, {})
    expect(result).toEqual({ ok: false, reason: 'empty' })
  })

  it('emits an svg root with a viewBox derived from bounds and padding', () => {
    const shape = createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 50, style: { sloppiness: 0 } })
    const svg = svgOf(sceneWith(shape), { padding: 10 })
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('viewBox="0 0 120 70"')
    expect(svg).toContain('width="120"')
    expect(svg).toContain('height="70"')
  })

  it('renders a straight shape outline as fill and stroke paths', () => {
    const shape = createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40, style: { sloppiness: 0 } })
    const svg = svgOf(sceneWith(shape))
    expect(svg).toContain('<path')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('stroke="#454545"')
    expect(svg).toMatch(/d="M [\d.-]+ [\d.-]+ L/)
  })

  it('renders rough sketch strokes as bezier path data', () => {
    const shape = createShape({ id: 'rough', type: 'rect', x: 0, y: 0, width: 120, height: 80, style: { sloppiness: 1 } })
    const svg = svgOf(sceneWith(shape))
    const strokePaths = svg.match(/<path[^>]*stroke="#454545"[^>]*\/>/g) ?? []
    expect(strokePaths.length).toBeGreaterThan(0)
    expect(strokePaths.some((path) => / C [\d.-]+ /.test(path))).toBe(true)
  })

  it('encodes dashed strokes as a stroke-dasharray', () => {
    const shape = createShape({
      id: 'dash',
      type: 'rect',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      style: { sloppiness: 0, strokeStyle: 'dashed' },
    })
    const svg = svgOf(sceneWith(shape))
    expect(svg).toContain('stroke-dasharray="10 6"')
  })

  it('renders text as a text element with font metadata and escaped content', () => {
    const text = createText({ id: 't', x: 0, y: 0, width: 200, height: 40, text: 'a < b & c' })
    const svg = svgOf(sceneWith(text))
    expect(svg).toContain('<text')
    expect(svg).toContain('font-family=')
    expect(svg).toContain('font-size="31"')
    expect(svg).toContain('a &lt; b &amp; c')
  })

  it('embeds images as an href data uri', () => {
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: (): void => {} }),
        toDataURL: () => 'data:image/png;base64,STUB',
      }),
    })
    const bitmap = { width: 40, height: 30 } as unknown as ImageBitmap
    setImageCache({ getBitmap: () => bitmap } as unknown as ImageCache)
    const image = createImage({
      id: 'img',
      assetId: 'asset-1',
      x: 0,
      y: 0,
      naturalWidth: 40,
      naturalHeight: 30,
      viewportWidth: 1000,
      viewportHeight: 1000,
    })
    const svg = svgOf(sceneWith(image))
    expect(svg).toContain('<image')
    expect(svg).toContain('href="data:image/png;base64,STUB"')
    expect(svg).toContain('preserveAspectRatio="none"')
  })

  it('paints a background rectangle when a background is requested', () => {
    const shape = createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40, style: { sloppiness: 0 } })
    const withBackground = svgOf(sceneWith(shape), { background: '#ffffff' })
    expect(withBackground).toContain('<rect x="0" y="0"')
    expect(withBackground).toContain('fill="#ffffff"')
    const transparent = svgOf(sceneWith(shape))
    expect(transparent).not.toContain('<rect x="0" y="0"')
  })

  it('renders a sticky note with a clipped drop-shadow filter', () => {
    const sticky = createSticky({ id: 's', x: 0, y: 0, width: 120, height: 120 })
    const svg = svgOf(sceneWith(sticky))
    expect(svg).toContain('<clipPath')
    expect(svg).toContain('clip-rule="evenodd"')
    expect(svg).toContain('<feDropShadow')
    expect(svg).toContain('filter="url(#fd-shadow-')
  })

  it('inverts colors and the background in dark mode', () => {
    const shape = createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40, style: { sloppiness: 0 } })
    const svg = svgOf(sceneWith(shape), { dark: true, background: '#ffffff' })
    expect(svg).toContain(`stroke="${invertColor('#454545')}"`)
    expect(svg).toContain(`fill="${invertColor('#ffffff')}"`)
  })
})
