import { describe, expect, it } from 'vitest'
import type { Rect } from './rect.js'
import { alignDeltas, distributeDeltas, type ArrangeTarget } from './arrange.js'

function target(id: string, x: number, y: number, width = 20, height = 20): ArrangeTarget {
  return { id, bounds: { x, y, width, height } }
}

function applied(targets: ArrangeTarget[], deltas: { id: string; dx: number; dy: number }[]): Map<string, Rect> {
  const byId = new Map(deltas.map((delta) => [delta.id, delta]))
  const result = new Map<string, Rect>()
  for (const { id, bounds } of targets) {
    const delta = byId.get(id) ?? { dx: 0, dy: 0 }
    result.set(id, { ...bounds, x: bounds.x + delta.dx, y: bounds.y + delta.dy })
  }
  return result
}

describe('alignDeltas', () => {
  const targets = [target('a', 0, 0, 40, 20), target('b', 100, 50, 20, 60), target('c', 30, 200, 10, 10)]

  it('returns nothing for fewer than two targets', () => {
    expect(alignDeltas([target('a', 0, 0)], 'left')).toEqual([])
  })

  it('aligns left edges to the group minimum', () => {
    const boxes = applied(targets, alignDeltas(targets, 'left'))
    expect(boxes.get('a')!.x).toBe(0)
    expect(boxes.get('b')!.x).toBe(0)
    expect(boxes.get('c')!.x).toBe(0)
  })

  it('aligns right edges to the group maximum', () => {
    const boxes = applied(targets, alignDeltas(targets, 'right'))
    const right = (id: string): number => boxes.get(id)!.x + boxes.get(id)!.width
    expect(right('a')).toBe(120)
    expect(right('b')).toBe(120)
    expect(right('c')).toBe(120)
  })

  it('centers horizontally on the group center', () => {
    const boxes = applied(targets, alignDeltas(targets, 'centerX'))
    const center = 120 / 2
    const mid = (id: string): number => boxes.get(id)!.x + boxes.get(id)!.width / 2
    expect(mid('a')).toBe(center)
    expect(mid('b')).toBe(center)
    expect(mid('c')).toBe(center)
  })

  it('aligns vertical edges without touching the other axis', () => {
    const boxes = applied(targets, alignDeltas(targets, 'top'))
    expect(boxes.get('a')!.y).toBe(0)
    expect(boxes.get('b')!.y).toBe(0)
    expect(boxes.get('c')!.y).toBe(0)
    expect(boxes.get('b')!.x).toBe(100)
  })
})

describe('distributeDeltas', () => {
  it('returns nothing for fewer than three targets', () => {
    expect(distributeDeltas([target('a', 0, 0), target('b', 100, 0)], 'horizontal')).toEqual([])
  })

  it('spaces items so gaps between them are equal', () => {
    const targets = [target('a', 0, 0, 10, 10), target('b', 20, 0, 10, 10), target('c', 100, 0, 10, 10)]
    const boxes = applied(targets, distributeDeltas(targets, 'horizontal'))
    const a = boxes.get('a')!
    const b = boxes.get('b')!
    const c = boxes.get('c')!
    expect(a.x).toBe(0)
    expect(c.x).toBe(100)
    expect(b.x - (a.x + a.width)).toBeCloseTo(c.x - (b.x + b.width))
  })

  it('distributes vertically along the y axis', () => {
    const targets = [target('a', 0, 0, 10, 10), target('b', 0, 5, 10, 10), target('c', 0, 100, 10, 10)]
    const boxes = applied(targets, distributeDeltas(targets, 'vertical'))
    const a = boxes.get('a')!
    const b = boxes.get('b')!
    const c = boxes.get('c')!
    expect(b.y - (a.y + a.height)).toBeCloseTo(c.y - (b.y + b.height))
    expect(b.x).toBe(0)
  })
})
