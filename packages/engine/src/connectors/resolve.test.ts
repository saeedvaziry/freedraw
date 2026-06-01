import { describe, expect, it } from 'vitest'
import { createArrow, createShape } from '../model/factory.js'
import type { Element, ElementId } from '../model/types.js'
import { createBinding } from './binding.js'
import { resolveArrowPoints } from './resolve.js'

function elementsMap(elements: Element[]): Record<ElementId, Element> {
  const map: Record<ElementId, Element> = {}
  elements.forEach((element) => {
    map[element.id] = element
  })
  return map
}

function allAxisAligned(points: { x: number; y: number }[]): boolean {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return false
  }
  return true
}

describe('resolveArrowPoints', () => {
  it('lands a bound end on the target edge facing the start', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 50 },
      ],
      start: createBinding(a, { x: 100, y: 50 }, 0),
      end: createBinding(b, { x: 300, y: 50 }, 0),
    })
    const points = resolveArrowPoints(arrow, elementsMap([a, b, arrow]))
    expect(points[0]!.x).toBeCloseTo(100)
    expect(points[1]!.x).toBeCloseTo(300)
    expect(points[0]!.y).toBeCloseTo(50)
    expect(points[1]!.y).toBeCloseTo(50)
  })

  it('keeps the bound endpoints pinned and the route axis-aligned after a move', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 50 },
      ],
      start: createBinding(a, { x: 100, y: 50 }, 0),
      end: createBinding(b, { x: 300, y: 50 }, 0),
    })
    const moved = { ...b, y: 200 }
    const points = resolveArrowPoints(arrow, elementsMap([a, moved, arrow]))
    expect(points[0]).toMatchObject({ x: 100, y: 50 })
    expect(points[points.length - 1]).toMatchObject({ x: 300, y: 250 })
    expect(allAxisAligned(points)).toBe(true)
  })

  it('applies the gap pull-back at the bound endpoint', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 50 },
      ],
      end: createBinding(b, { x: 300, y: 50 }, 10),
    })
    const points = resolveArrowPoints(arrow, elementsMap([a, b, arrow]))
    expect(points[points.length - 1]).toMatchObject({ x: 290, y: 50 })
  })

  it('leaves a free endpoint untouched', () => {
    const b = createShape({ id: 'b', x: 300, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 10, y: 10 },
        { x: 300, y: 50 },
      ],
      end: createBinding(b, { x: 300, y: 50 }, 0),
    })
    const points = resolveArrowPoints(arrow, elementsMap([b, arrow]))
    expect(points[0]).toEqual({ x: 10, y: 10 })
  })

  it('stays straight (2 points) when ports already face each other', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 50 },
      ],
      start: createBinding(a, { x: 100, y: 50 }, 0),
      end: createBinding(b, { x: 300, y: 50 }, 0),
    })
    expect(resolveArrowPoints(arrow, elementsMap([a, b, arrow]))).toHaveLength(2)
  })

  it('keeps a nearly aligned bound arrow straight', () => {
    const a = createShape({ id: 'a', x: 0, y: 100, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 50, y: 100 },
        { x: 62, y: 0 },
      ],
      start: createBinding(a, { x: 50, y: 100 }, 0),
    })

    expect(resolveArrowPoints(arrow, elementsMap([a, arrow]))).toHaveLength(2)
  })

  it('routes orthogonally (right angles only) when ports are offset on both axes', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 300, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 350 },
      ],
      start: createBinding(a, { x: 100, y: 50 }, 0),
      end: createBinding(b, { x: 300, y: 350 }, 0),
    })
    const points = resolveArrowPoints(arrow, elementsMap([a, b, arrow]))
    expect(points.length).toBeGreaterThanOrEqual(3)
    expect(points[0]).toMatchObject({ x: 100, y: 50 })
    expect(points[points.length - 1]).toMatchObject({ x: 300, y: 350 })
    expect(allAxisAligned(points)).toBe(true)
  })

  it('does not double back through the shape when the port faces away from a free end', () => {
    const a = createShape({ id: 'a', x: 300, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 400, y: 50 },
        { x: 50, y: 400 },
      ],
      start: createBinding(a, { x: 400, y: 50 }, 0),
    })
    const points = resolveArrowPoints(arrow, elementsMap([a, arrow]))
    expect(allAxisAligned(points)).toBe(true)
    expect(points[0]).toMatchObject({ x: 400, y: 50 })
    expect(points[points.length - 1]).toMatchObject({ x: 50, y: 400 })
    const second = points[1]!
    expect(second.x).toBeGreaterThanOrEqual(400)
    expect(points.every((p) => p.x >= 50 - 0.5)).toBe(true)
  })

  it('leaves and enters each port along its edge normal', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 300, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 350 },
      ],
      start: createBinding(a, { x: 100, y: 50 }, 0),
      end: createBinding(b, { x: 300, y: 350 }, 0),
    })
    const points = resolveArrowPoints(arrow, elementsMap([a, b, arrow]))
    expect(points[1]!.y).toBeCloseTo(50)
    expect(points[1]!.x).toBeGreaterThan(100)
    expect(points[points.length - 2]!.y).toBeCloseTo(350)
    expect(points[points.length - 2]!.x).toBeLessThan(300)
  })

  it('preserves user waypoints, only re-pinning the bound endpoints', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 100, y: 50 },
        { x: 200, y: 200 },
        { x: 400, y: 50 },
      ],
      start: createBinding(a, { x: 100, y: 50 }, 0),
    })
    const points = resolveArrowPoints(arrow, elementsMap([a, arrow]))
    expect(points).toHaveLength(3)
    expect(points[1]).toEqual({ x: 200, y: 200 })
  })
})
