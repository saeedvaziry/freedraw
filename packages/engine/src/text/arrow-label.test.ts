import { describe, expect, it } from 'vitest'
import { createArrow } from '../model/factory.js'
import { defaultStyle } from '../model/schema.js'
import { arrowLabelEditRect } from './arrow-label.js'

describe('arrowLabelEditRect', () => {
  it('grows wide enough for long labels while staying centered on the arrow', () => {
    const arrow = createArrow({
      id: 'arrow-1',
      points: [
        { x: 0, y: 0 },
        { x: 240, y: 0 },
      ],
    })
    const empty = arrowLabelEditRect(arrow.route, '', defaultStyle)
    const long = arrowLabelEditRect(
      arrow.route,
      'relationship label that should not overflow while editing',
      defaultStyle,
    )

    expect(empty.width).toBe(120)
    expect(long.width).toBeGreaterThan(empty.width)
    expect(long.x + long.width / 2).toBeCloseTo(empty.x + empty.width / 2)
  })
})
