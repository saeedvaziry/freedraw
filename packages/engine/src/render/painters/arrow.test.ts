import { describe, expect, it } from 'vitest'
import { trimmedShaftPoints } from './arrow.js'

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
