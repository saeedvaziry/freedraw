import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImageCache } from '../assets/image-cache.js'
import { createImage, createShape, createSticky, createText } from '../model/factory.js'
import { defaultAppState } from '../model/schema.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { clearDrawCaches } from './draw-cache.js'
import { SvgDrawTarget, setSvgFontFaces } from './draw-target.js'
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

function imageElement(): Element {
  return createImage({
    id: 'img',
    assetId: 'asset-1',
    x: 0,
    y: 0,
    naturalWidth: 40,
    naturalHeight: 30,
    viewportWidth: 1000,
    viewportHeight: 1000,
  })
}

function pathData(svg: string): string {
  return /<path[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ?? ''
}

function anchorBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs: number[] = []
  const ys: number[] = []
  for (const command of d.match(/[MLCQ][^MLCQZ]*/g) ?? []) {
    const numbers = (command.slice(1).match(/-?[\d.]+/g) ?? []).map(Number)
    const y = numbers.pop()
    const x = numbers.pop()
    if (x === undefined || y === undefined) continue
    xs.push(x)
    ys.push(y)
  }
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

function stubImageDocument(): void {
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: (): void => {} }),
      toDataURL: () => 'data:image/png;base64,STUB',
    }),
  })
}

function stubImageCache(sourceDataUrl: string | undefined): void {
  const bitmap = { width: 40, height: 30 } as unknown as ImageBitmap
  setImageCache({
    getBitmap: () => bitmap,
    getSourceDataUrl: () => sourceDataUrl,
  } as unknown as ImageCache)
}

describe('renderSceneSvg', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setImageCache(null)
    setSvgFontFaces([])
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

  it('embeds the original asset blob with its own mime type', () => {
    stubImageDocument()
    stubImageCache('data:image/webp;base64,ORIGINAL')
    const svg = svgOf(sceneWith(imageElement()))
    expect(svg).toContain('<image')
    expect(svg).toContain('href="data:image/webp;base64,ORIGINAL"')
    expect(svg).toContain('preserveAspectRatio="none"')
    expect(svg).not.toContain('STUB')
  })

  it('emits an xlink:href fallback and declares the xlink namespace', () => {
    stubImageDocument()
    stubImageCache('data:image/webp;base64,ORIGINAL')
    const svg = svgOf(sceneWith(imageElement()))
    expect(svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"')
    expect(svg).toContain('xlink:href="data:image/webp;base64,ORIGINAL"')
  })

  it('omits the xlink namespace when no image is drawn', () => {
    const shape = createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40, style: { sloppiness: 0 } })
    expect(svgOf(sceneWith(shape))).not.toContain('xmlns:xlink')
  })

  it('falls back to re-encoding the bitmap when the original blob is unavailable', () => {
    stubImageDocument()
    stubImageCache(undefined)
    const svg = svgOf(sceneWith(imageElement()))
    expect(svg).toContain('href="data:image/png;base64,STUB"')
  })

  it('embeds a font-face for a supplied font used by the scene', () => {
    setSvgFontFaces([
      { family: 'Architects Daughter', source: 'data:font/woff2;base64,FONT', weight: 400, style: 'normal' },
      { family: 'Unused Face', source: 'data:font/woff2;base64,NOPE' },
    ])
    const text = createText({ id: 't', x: 0, y: 0, width: 200, height: 40, text: 'hello' })
    const svg = svgOf(sceneWith(text))
    expect(svg).toContain('<defs><style>')
    expect(svg).toContain("@font-face{font-family:'Architects Daughter'")
    expect(svg).toContain('src:url("data:font/woff2;base64,FONT")')
    expect(svg).toContain('font-weight:400')
    expect(svg).toContain('font-style:normal')
    expect(svg).not.toContain('NOPE')
  })

  it('omits the font-face style when no supplied font is used', () => {
    setSvgFontFaces([{ family: 'Unused Face', source: 'data:font/woff2;base64,NOPE' }])
    const shape = createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40, style: { sloppiness: 0 } })
    expect(svgOf(sceneWith(shape))).not.toContain('<style>')
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

  it('shares one shadow filter across many same-sized stickies', () => {
    const stickies = Array.from({ length: 8 }, (_, index) =>
      createSticky({ id: `s${index}`, x: index * 400, y: index * 250, width: 200, height: 200 }),
    )
    const svg = svgOf(sceneWith(...stickies))
    expect(svg.match(/filter="url\(#fd-shadow-/g) ?? []).toHaveLength(8)
    expect(svg.match(/<filter /g) ?? []).toHaveLength(1)
  })

  it('inverts colors and the background in dark mode', () => {
    const shape = createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40, style: { sloppiness: 0 } })
    const svg = svgOf(sceneWith(shape), { dark: true, background: '#ffffff' })
    expect(svg).toContain(`stroke="${invertColor('#454545')}"`)
    expect(svg).toContain(`fill="${invertColor('#ffffff')}"`)
  })
})

describe('SvgDrawTarget', () => {
  function target(fonts?: { family: string; source: string }[]): SvgDrawTarget {
    return new SvgDrawTarget({
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      padding: 0,
      scale: 1,
      background: null,
      fonts,
    })
  }

  it('maps canvas shadowBlur to a gaussian sigma of half the blur radius', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.shadowColor = '#ff0000'
    svg.shadowBlur = 8
    svg.shadowOffsetX = 3
    svg.shadowOffsetY = 4
    svg.fillRect(0, 0, 10, 10)
    const out = svg.toSvg()
    expect(out).toContain('stdDeviation="4"')
    expect(out).toContain('dx="3" dy="4"')
    expect(out).toContain('flood-color="#ff0000"')
  })

  it('derives the filter region from the blur radius and offset instead of a fixed percentage', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.shadowColor = '#000000'
    svg.shadowBlur = 4
    svg.fillRect(10, 10, 20, 20)
    const out = svg.toSvg()
    expect(out).toContain('x="-37.5%" y="-37.5%" width="175%" height="175%"')
    expect(out).not.toContain('x="-50%"')
    expect(out).not.toContain('userSpaceOnUse')
  })

  it('grows the filter region for large blur radii and large offsets', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.shadowColor = '#000000'
    svg.shadowBlur = 40
    svg.shadowOffsetY = 30
    svg.fillRect(10, 10, 20, 20)
    expect(svg.toSvg()).toContain('x="-312.5%" y="-462.5%" width="725%" height="1025%"')
  })

  it('reuses one filter for repeated shadows with the same geometry', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.shadowColor = '#000000'
    svg.shadowBlur = 4
    svg.fillRect(10, 10, 20, 20)
    svg.fillRect(10, 10, 20, 20)
    expect(svg.toSvg().match(/<filter /g) ?? []).toHaveLength(1)
  })

  it('reuses one filter for same-sized shapes drawn at different positions', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.shadowColor = '#000000'
    svg.shadowBlur = 4
    svg.fillRect(0, 0, 20, 20)
    svg.fillRect(400, 250, 20, 20)
    svg.fillRect(-90, 730, 20, 20)
    const out = svg.toSvg()
    expect(out.match(/filter="url\(#fd-shadow-/g) ?? []).toHaveLength(3)
    expect(out.match(/<filter /g) ?? []).toHaveLength(1)
  })

  it('quantizes near-equal geometry onto a shared filter without shrinking the region', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.shadowColor = '#000000'
    svg.shadowBlur = 4
    svg.fillRect(0, 0, 200, 200)
    svg.fillRect(0, 0, 214, 207)
    const out = svg.toSvg()
    expect(out.match(/<filter /g) ?? []).toHaveLength(1)
    expect(out).toContain('x="-12.5%" y="-12.5%" width="125%" height="125%"')
  })

  it('keeps the filter region unclipped for wildly different shape sizes', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.shadowColor = '#000000'
    svg.shadowBlur = 20
    svg.fillRect(0, 0, 400, 400)
    svg.fillRect(0, 0, 20, 20)
    const out = svg.toSvg()
    const spreads = [...out.matchAll(/<filter [^>]*\sx="-([\d.]+)%"/g)].map(
      (match) => Number(match[1]) / 100,
    )
    expect(spreads).toHaveLength(2)
    expect(spreads[0]).not.toBe(spreads[1])
    expect(spreads[0]! * 400).toBeGreaterThanOrEqual(30)
    expect(spreads[1]! * 20).toBeGreaterThanOrEqual(30)
  })

  it('applies the shadow filter to strokes with a region that survives a flat path', () => {
    const svg = target()
    svg.strokeStyle = '#123456'
    svg.lineWidth = 2
    svg.shadowColor = '#00ff00'
    svg.shadowBlur = 6
    svg.beginPath()
    svg.moveTo(10, 50)
    svg.lineTo(90, 50)
    svg.stroke()
    const out = svg.toSvg()
    expect(out).toContain('flood-color="#00ff00"')
    expect(out).toMatch(/<path[^>]*stroke="#123456"[^>]*filter="url\(#fd-shadow-/)
    expect(out).toContain('filterUnits="userSpaceOnUse" x="0" y="40" width="100" height="20"')
  })

  it('applies the shadow filter to text', () => {
    const svg = target()
    svg.fillStyle = '#000000'
    svg.font = '20px sans-serif'
    svg.shadowColor = 'rgba(0, 0, 0, 0.5)'
    svg.shadowBlur = 8
    svg.shadowOffsetY = 2
    svg.fillText('hi', 10, 20)
    const out = svg.toSvg()
    expect(out).toMatch(/<text[^>]*filter="url\(#fd-shadow-/)
    expect(out).toContain('flood-color="rgba(0, 0, 0, 0.5)"')
  })

  it('applies the shadow filter to images', () => {
    const svg = target()
    svg.shadowColor = '#ff00ff'
    svg.shadowBlur = 10
    svg.drawImage(
      {} as unknown as CanvasImageSource,
      0,
      0,
      20,
      20,
      () => 'data:image/png;base64,X',
    )
    const out = svg.toSvg()
    expect(out).toMatch(/<image[^>]*filter="url\(#fd-shadow-/)
    expect(out).toContain('x="-87.5%" y="-87.5%" width="275%" height="275%"')
  })

  it('leaves strokes, text and images unfiltered when no shadow is set', () => {
    const svg = target()
    svg.strokeStyle = '#123456'
    svg.beginPath()
    svg.moveTo(0, 0)
    svg.lineTo(10, 10)
    svg.stroke()
    svg.fillStyle = '#000000'
    svg.fillText('hi', 0, 0)
    expect(svg.toSvg()).not.toContain('filter="url(#fd-shadow-')
  })

  it('rotates ellipse points by the rotation argument', () => {
    const svg = target()
    svg.strokeStyle = '#000000'
    svg.beginPath()
    svg.ellipse(50, 50, 10, 2, Math.PI / 2, 0, Math.PI * 2)
    svg.stroke()
    const box = anchorBounds(pathData(svg.toSvg()))
    expect(box.minX).toBeCloseTo(48, 3)
    expect(box.maxX).toBeCloseTo(52, 3)
    expect(box.minY).toBeCloseTo(40, 3)
    expect(box.maxY).toBeCloseTo(60, 3)
  })

  it('keeps an unrotated ellipse axis aligned', () => {
    const svg = target()
    svg.strokeStyle = '#000000'
    svg.beginPath()
    svg.ellipse(50, 50, 10, 2, 0, 0, Math.PI * 2)
    svg.stroke()
    const box = anchorBounds(pathData(svg.toSvg()))
    expect(box.minX).toBeCloseTo(40, 3)
    expect(box.maxX).toBeCloseTo(60, 3)
    expect(box.minY).toBeCloseTo(48, 3)
    expect(box.maxY).toBeCloseTo(52, 3)
  })

  it('accepts font faces from its config without touching the global registry', () => {
    const svg = target([{ family: 'Architects Daughter', source: 'data:font/woff2;base64,LOCAL' }])
    svg.font = "20px 'Architects Daughter', cursive"
    svg.fillStyle = '#000000'
    svg.fillText('hi', 0, 0)
    expect(svg.toSvg()).toContain('src:url("data:font/woff2;base64,LOCAL")')
  })

  it('escapes quotes inside font face values', () => {
    const svg = target([{ family: 'Weird Font', source: 'data:font/woff2;base64,A"B' }])
    svg.font = '20px Weird Font'
    svg.fillStyle = '#000000'
    svg.fillText('hi', 0, 0)
    expect(svg.toSvg()).toContain('src:url("data:font/woff2;base64,A\\"B")')
  })
})
