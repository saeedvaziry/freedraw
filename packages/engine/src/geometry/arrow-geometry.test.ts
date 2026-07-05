import { describe, expect, it } from 'vitest'
import { snapRouteSegmentTarget } from './arrow-geometry.js'

describe('snapRouteSegmentTarget', () => {
  it('snaps a dragged segment to nearby route axes before grid snapping', () => {
    const route = [
      { x: 47, y: 20 },
      { x: 47, y: 120 },
      { x: 70, y: 120 },
      { x: 70, y: 240 },
    ]

    const target = snapRouteSegmentTarget(route, 2, { x: 48, y: 180 })

    expect(target.x).toBe(47)
  })
})
