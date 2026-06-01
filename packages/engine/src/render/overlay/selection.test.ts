import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/Camera.js'
import { marqueeScreenRect } from './selection.js'

describe('marqueeScreenRect', () => {
  it('projects a world marquee through the camera', () => {
    const camera = new Camera({ x: 100, y: 50, zoom: 2 })

    expect(marqueeScreenRect({ x: 120, y: 80, width: 30, height: 20 }, camera)).toEqual({
      x: 40,
      y: 60,
      width: 60,
      height: 40,
    })
  })
})
