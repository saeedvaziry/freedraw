import { describe, expect, it } from 'vitest'
import { roundedShaftPathData, trimmedShaftPoints } from './arrow.js'

describe('trimmedShaftPoints', () => {
  it('moves terminal shaft points inward under arrowheads', () => {
    expect(trimmedShaftPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, 20)).toEqual([
      { x: 10, y: 0 },
      { x: 80, y: 0 },
    ])
  })

  it('keeps interior waypoints unchanged', () => {
    expect(
      trimmedShaftPoints(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 50, y: 50 },
        ],
        10,
        10,
      ),
    ).toEqual([
      { x: 10, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 40 },
    ])
  })
})

describe('roundedShaftPathData', () => {
  it('keeps a two-point route straight', () => {
    expect(roundedShaftPathData([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe('M 0 0 L 100 0')
  })

  it('rounds an orthogonal bend with a quadratic curve', () => {
    expect(
      roundedShaftPathData([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
      ]),
    ).toBe('M 0 0 L 32 0 Q 50 0 50 18 L 50 50')
  })

  it('clamps the bend radius for short segments', () => {
    expect(
      roundedShaftPathData([
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 12 },
      ]),
    ).toBe('M 0 0 L 6 0 Q 12 0 12 6 L 12 12')
  })
})
