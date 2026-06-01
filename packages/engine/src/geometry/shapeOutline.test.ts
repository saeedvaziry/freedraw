import { describe, expect, it } from 'vitest'
import { getOutline, pointInPolygon } from './shapeOutline.js'
import type { Rect } from './rect.js'

const bounds: Rect = { x: 0, y: 0, width: 100, height: 80 }

function polygonPoints(type: string) {
  const outline = getOutline(type, bounds)
  if (!outline || outline.kind !== 'polygon') throw new Error(`${type} is not a polygon`)
  return outline.points
}

describe('shapeOutline', () => {
  it('produces 4 corners for a rect at the bounds', () => {
    const points = polygonPoints('rect')
    expect(points).toHaveLength(4)
    expect(points).toContainEqual({ x: 0, y: 0 })
    expect(points).toContainEqual({ x: 100, y: 80 })
  })

  it('produces 4 vertices for a diamond at the edge midpoints', () => {
    const points = polygonPoints('diamond')
    expect(points).toHaveLength(4)
    expect(points).toContainEqual({ x: 50, y: 0 })
    expect(points).toContainEqual({ x: 100, y: 40 })
  })

  it('produces 3 vertices for a triangle', () => {
    expect(polygonPoints('triangle')).toHaveLength(3)
  })

  it('produces 6 vertices for a hexagon', () => {
    expect(polygonPoints('hexagon')).toHaveLength(6)
  })

  it('produces 10 vertices for a 5-point star', () => {
    expect(polygonPoints('star')).toHaveLength(10)
  })

  it('keeps every polygon vertex within its bounds', () => {
    for (const type of ['rect', 'diamond', 'triangle', 'hexagon', 'parallelogram', 'star']) {
      for (const point of polygonPoints(type)) {
        expect(point.x).toBeGreaterThanOrEqual(bounds.x)
        expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width)
        expect(point.y).toBeGreaterThanOrEqual(bounds.y)
        expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height)
      }
    }
  })

  it('models an ellipse with center and radii', () => {
    const outline = getOutline('ellipse', bounds)
    expect(outline).toEqual({ kind: 'ellipse', cx: 50, cy: 40, rx: 50, ry: 40 })
  })

  it('returns undefined for an unknown type', () => {
    expect(getOutline('unknown', bounds)).toBeUndefined()
  })

  it('uses roundness for rectangular outlines', () => {
    expect(getOutline('rect', bounds, 0)?.kind).toBe('polygon')
    expect(getOutline('rect', bounds, 12)?.kind).toBe('path')
    expect(getOutline('roundRect', bounds, 12)?.kind).toBe('path')
  })

  it('point-in-polygon hits inside and misses outside a diamond', () => {
    const diamond = polygonPoints('diamond')
    expect(pointInPolygon({ x: 50, y: 40 }, diamond)).toBe(true)
    expect(pointInPolygon({ x: 2, y: 2 }, diamond)).toBe(false)
  })

  it('point-in-polygon hits inside and misses outside a triangle', () => {
    const triangle = polygonPoints('triangle')
    expect(pointInPolygon({ x: 50, y: 60 }, triangle)).toBe(true)
    expect(pointInPolygon({ x: 5, y: 5 }, triangle)).toBe(false)
  })
})
