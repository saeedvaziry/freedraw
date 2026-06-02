import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/Camera.js'
import { createArrow } from '../../model/factory.js'
import { arrowHandlesScreen } from './arrowHandles.js'

describe('arrowHandlesScreen', () => {
  it('creates a midpoint handle for each editable route segment', () => {
    const arrow = {
      ...createArrow({
        id: 'arrow',
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 100 },
        ],
      }),
      route: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 100 },
        { x: 200, y: 100 },
      ],
    }

    const midpoints = arrowHandlesScreen(arrow, new Camera()).filter((handle) => handle.id === 'midpoint')

    expect(midpoints).toEqual([
      { id: 'midpoint', segmentIndex: 0, axis: 'horizontal', position: { x: 60, y: 0 } },
      { id: 'midpoint', segmentIndex: 1, axis: 'vertical', position: { x: 120, y: 50 } },
      { id: 'midpoint', segmentIndex: 2, axis: 'horizontal', position: { x: 160, y: 100 } },
    ])
  })
})
