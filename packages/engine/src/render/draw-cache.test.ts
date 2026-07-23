import { describe, expect, it } from 'vitest'
import type { Op } from 'roughjs/bin/core.js'
import { getStroke } from 'perfect-freehand'
import { getOutline } from '../geometry/shape-outline.js'
import { createFreedraw, createShape } from '../model/factory.js'
import type { ShapeType } from '../model/types.js'
import { hashSeed, roughOutlineDrawable } from './rough.js'
import { invertColor } from './invert.js'
import { paintShape } from './painters/shape.js'
import { freedrawSize, paintFreedraw } from './painters/freedraw.js'
import {
  clearDrawCaches,
  colorCache,
  DrawableCache,
  drawableCache,
  elementColors,
  StrokeCache,
  strokeCache,
  sweepDrawCaches,
} from './draw-cache.js'

const round = (v: number): number => Math.round(v * 100) / 100

function ops(drawable: { sets: { type: string; ops: Op[] }[] }): Op[] {
  return drawable.sets.filter((s) => s.type === 'path').flatMap((s) => s.ops)
}

function translated(list: Op[], dx: number, dy: number): Op[] {
  return list.map((op) => ({ op: op.op, data: op.data.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)) }))
}

function maxOpError(a: Op[], b: Op[]): number {
  if (a.length !== b.length) return Infinity
  let max = 0
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]!.op !== b[i]!.op) return Infinity
    const da = a[i]!.data
    const db = b[i]!.data
    if (da.length !== db.length) return Infinity
    for (let j = 0; j < da.length; j += 1) max = Math.max(max, Math.abs(da[j]! - db[j]!))
  }
  return max
}

function fakeCtx(): CanvasRenderingContext2D {
  const noop = (): void => {}
  return new Proxy({}, { get: () => noop, set: () => true }) as unknown as CanvasRenderingContext2D
}

const SHAPE_TYPES: ShapeType[] = [
  'rect',
  'roundRect',
  'ellipse',
  'diamond',
  'triangle',
  'cylinder',
  'hexagon',
  'parallelogram',
  'star',
  'cloud',
  'heart',
  'lightning',
]

describe('KeyedCache', () => {
  it('reuses the value while the key is unchanged and regenerates on key change', () => {
    const cache = new StrokeCache()
    let calls = 0
    const make = (): number[][] => {
      calls += 1
      return [[calls, calls]]
    }
    expect(cache.get('a', 'k', make)).toEqual([[1, 1]])
    cache.get('a', 'k', make)
    expect(calls).toBe(1)
    cache.get('a', 'k2', make)
    expect(calls).toBe(2)
  })

  it('sweeps entries whose id is not live', () => {
    const cache = new DrawableCache()
    cache.get('a', 'k', () => ({}) as never)
    cache.get('b', 'k', () => ({}) as never)
    cache.sweep(new Set(['a']))
    expect(cache.size).toBe(1)
  })

  it('invalidates and clears', () => {
    const cache = new StrokeCache()
    cache.get('a', 'k', () => [])
    cache.get('b', 'k', () => [])
    cache.invalidate('a')
    expect(cache.size).toBe(1)
    cache.clear()
    expect(cache.size).toBe(0)
  })
})

describe('rough drawable pixel identity', () => {
  const dx = 731
  const dy = 412
  it.each(SHAPE_TYPES)('%s: generated at the origin + translated == generated absolute', (type) => {
    const seed = hashSeed(type)
    const local = getOutline(type, { x: 0, y: 0, width: 120, height: 80 }, 8)!
    const abs = getOutline(type, { x: dx, y: dy, width: 120, height: 80 }, 8)!
    const err = maxOpError(
      translated(ops(roughOutlineDrawable(local, 1, seed)), dx, dy),
      ops(roughOutlineDrawable(abs, 1, seed)),
    )
    expect(err).toBeLessThan(1e-6)
  })
})

describe('freehand stroke pixel identity', () => {
  it('is translation invariant', () => {
    const dx = 500
    const dy = 250
    const pts = [
      [0, 0],
      [40, 55],
      [90, 10],
      [120, 80],
    ] as [number, number][]
    const absPts = pts.map(([x, y]) => [x + dx, y + dy] as [number, number])
    const opts = { size: 8, smoothing: 0.5, thinning: 0.6, streamline: 0.5 }
    const l = getStroke(pts, opts)
    const a = getStroke(absPts, opts)
    expect(l.length).toBe(a.length)
    let err = 0
    for (let i = 0; i < l.length; i += 1) {
      err = Math.max(err, Math.abs(l[i]![0]! + dx - a[i]![0]!), Math.abs(l[i]![1]! + dy - a[i]![1]!))
    }
    expect(err).toBeLessThan(1e-6)
  })
})

describe('painter caches are position-independent (a pure MOVE is a hit)', () => {
  it('caches a shape rough drawable and reuses it after a move', () => {
    clearDrawCaches()
    const style = { sloppiness: 1 }
    const el = createShape({ id: 'shape', type: 'rect', x: 10, y: 20, width: 100, height: 60, style })
    paintShape(fakeCtx(), el, false)
    expect(drawableCache.size).toBe(1)

    const key = `rect|${round(el.width)}|${round(el.height)}|${el.style.roundness}|${el.style.sloppiness}`
    expect(() =>
      drawableCache.get('shape', key, () => {
        throw new Error('regenerated')
      }),
    ).not.toThrow()

    paintShape(fakeCtx(), { ...el, x: 999, y: 555 }, false)
    expect(drawableCache.size).toBe(1)
    expect(() =>
      drawableCache.get('shape', key, () => {
        throw new Error('regenerated')
      }),
    ).not.toThrow()
  })

  it('caches a freehand stroke and reuses it after a move', () => {
    clearDrawCaches()
    const points = [
      { x: 10, y: 10 },
      { x: 30, y: 40 },
      { x: 70, y: 20 },
    ]
    const fd = createFreedraw({ id: 'fd', points, style: { strokeWidth: 2 } })
    paintFreedraw(fakeCtx(), fd, false)
    expect(strokeCache.size).toBe(1)

    const key = `${freedrawSize(fd.style.strokeWidth)}|${points.length}|${round(fd.width)}|${round(fd.height)}`
    expect(() =>
      strokeCache.get('fd', key, () => {
        throw new Error('regenerated')
      }),
    ).not.toThrow()

    const delta = 200
    const moved = createFreedraw({
      id: 'fd',
      points: points.map((p) => ({ x: p.x + delta, y: p.y + delta })),
      style: { strokeWidth: 2 },
    })
    paintFreedraw(fakeCtx(), moved, false)
    expect(strokeCache.size).toBe(1)
    expect(() =>
      strokeCache.get('fd', key, () => {
        throw new Error('regenerated')
      }),
    ).not.toThrow()
  })

  it('regenerates a shape drawable when its geometry changes', () => {
    clearDrawCaches()
    const style = { sloppiness: 1 }
    const el = createShape({ id: 'shape', type: 'rect', x: 0, y: 0, width: 100, height: 60, style })
    paintShape(fakeCtx(), el, false)
    paintShape(fakeCtx(), { ...el, width: 200 }, false)
    expect(drawableCache.size).toBe(1)
    const key = `rect|${round(200)}|${round(60)}|${el.style.roundness}|${el.style.sloppiness}`
    expect(() =>
      drawableCache.get('shape', key, () => {
        throw new Error('regenerated')
      }),
    ).not.toThrow()
  })

  it('sweepDrawCaches drops entries for deleted ids', () => {
    clearDrawCaches()
    const style = { sloppiness: 1 }
    paintShape(fakeCtx(), createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 40, height: 40, style }), false)
    paintShape(fakeCtx(), createShape({ id: 'b', type: 'rect', x: 0, y: 0, width: 40, height: 40, style }), false)
    expect(drawableCache.size).toBe(2)
    sweepDrawCaches(new Set(['a']))
    expect(drawableCache.size).toBe(1)
  })
})

describe('elementColors precompute', () => {
  it('inverts stroke, fill, and text to match invertColor in dark mode', () => {
    clearDrawCaches()
    const el = createShape({
      id: 'colors',
      type: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: { stroke: '#454545', fill: '#ffffff', textColor: '#123456' },
    })
    expect(elementColors(el, true)).toEqual({
      stroke: invertColor('#454545'),
      fill: invertColor('#ffffff'),
      textColor: invertColor('#123456'),
    })
  })

  it('returns raw style colors when not dark', () => {
    const el = createShape({
      id: 'c2',
      type: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: { stroke: '#111111', fill: '#222222', textColor: '#333333' },
    })
    expect(elementColors(el, false)).toEqual({
      stroke: '#111111',
      fill: '#222222',
      textColor: '#333333',
    })
  })

  it('caches by id and colors, independent of position, and clears', () => {
    clearDrawCaches()
    const el = createShape({
      id: 'c3',
      type: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      style: { stroke: '#454545', fill: '#ffffff', textColor: '#454545' },
    })
    const first = elementColors(el, true)
    expect(colorCache.size).toBe(1)
    expect(elementColors({ ...el, x: 500, y: 500 }, true)).toBe(first)
    expect(colorCache.size).toBe(1)
    clearDrawCaches()
    expect(colorCache.size).toBe(0)
  })

  it('sweeps color entries for deleted ids', () => {
    clearDrawCaches()
    const style = { stroke: '#454545', fill: '#ffffff', textColor: '#454545' }
    elementColors(createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 10, height: 10, style }), true)
    elementColors(createShape({ id: 'b', type: 'rect', x: 0, y: 0, width: 10, height: 10, style }), true)
    expect(colorCache.size).toBe(2)
    sweepDrawCaches(new Set(['a']))
    expect(colorCache.size).toBe(1)
  })
})

class ColorRecordingContext {
  fillStyle = ''
  strokeStyle = ''
  globalAlpha = 1
  lineJoin: CanvasLineJoin = 'miter'
  lineWidth = 1
  readonly fills: string[] = []
  readonly strokes: string[] = []
  save(): void {}
  restore(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  arcTo(): void {}
  ellipse(): void {}
  quadraticCurveTo(): void {}
  bezierCurveTo(): void {}
  closePath(): void {}
  setLineDash(): void {}
  translate(): void {}
  fill(): void {
    this.fills.push(String(this.fillStyle))
  }
  stroke(): void {
    this.strokes.push(String(this.strokeStyle))
  }
}

describe('painters read precomputed colors on a raw context', () => {
  it('applies raw style colors when not dark', () => {
    clearDrawCaches()
    const el = createShape({
      id: 'raw-light',
      type: 'rect',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      style: { sloppiness: 0 },
    })
    const ctx = new ColorRecordingContext()
    paintShape(ctx as unknown as CanvasRenderingContext2D, el, false)
    expect(ctx.fills).toContain(el.style.fill)
    expect(ctx.strokes).toContain(el.style.stroke)
  })

  it('applies precomputed inverted colors when dark', () => {
    clearDrawCaches()
    const el = createShape({
      id: 'raw-dark',
      type: 'rect',
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      style: { sloppiness: 0 },
    })
    const ctx = new ColorRecordingContext()
    paintShape(ctx as unknown as CanvasRenderingContext2D, el, true)
    expect(ctx.fills).toContain(invertColor(el.style.fill))
    expect(ctx.strokes).toContain(invertColor(el.style.stroke))
    expect(ctx.fills).not.toContain(el.style.fill)
  })
})
