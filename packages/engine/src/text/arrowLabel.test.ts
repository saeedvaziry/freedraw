import { describe, expect, it } from 'vitest'
import { polylineMidpoint } from './arrowLabel.js'

describe('polylineMidpoint', () => {
  it('returns the center of a straight segment', () => {
    expect(polylineMidpoint([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toEqual({ x: 50, y: 0 })
  })

  it('finds the arc-length midpoint across multiple segments', () => {
    const mid = polylineMidpoint([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(mid).toEqual({ x: 100, y: 0 })
  })

  it('places the midpoint inside the longer second segment', () => {
    const mid = polylineMidpoint([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 120, y: 0 },
    ])
    expect(mid.x).toBeCloseTo(60)
    expect(mid.y).toBeCloseTo(0)
  })

  it('handles a degenerate zero-length polyline', () => {
    expect(polylineMidpoint([{ x: 5, y: 5 }, { x: 5, y: 5 }])).toEqual({ x: 5, y: 5 })
  })
})
