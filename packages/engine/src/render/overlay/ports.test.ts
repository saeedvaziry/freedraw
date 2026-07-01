import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/camera.js'
import { defaultStyle } from '../../model/schema.js'
import type { Element } from '../../model/types.js'
import { portAtScreen } from './ports.js'

const camera = new Camera({ x: 0, y: 0, zoom: 1 })

const rect: Element = {
  id: 'r1',
  type: 'rect',
  x: 0,
  y: 0,
  width: 120,
  height: 80,
  rotation: 0,
  style: { ...defaultStyle },
}

describe('portAtScreen', () => {
  it('ignores the edge midpoint where the resize handle lives', () => {
    expect(portAtScreen({ x: 120, y: 40 }, rect, camera)).toBeNull()
  })

  it('matches the outward port nub beyond the edge', () => {
    const port = portAtScreen({ x: 140, y: 40 }, rect, camera)
    expect(port).not.toBeNull()
    expect(port!.x).toBe(120)
    expect(port!.y).toBe(40)
  })
})
