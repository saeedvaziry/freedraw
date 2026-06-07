import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/Camera.js'
import { createShape } from '../../model/factory.js'
import { portAtScreen, portHandleWorld, portHoverAtScreen, PORT_OFFSET, shapePortHandlesScreen, shapePortsWorld } from './ports.js'

describe('shape connector ports', () => {
  it('keeps connector controls outside the shape while returning edge anchors', () => {
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 100 })
    const camera = new Camera()

    expect(shapePortsWorld(shape)).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ])
    expect(shapePortHandlesScreen(shape, camera).map((handle) => handle.position)).toEqual([
      { x: 50, y: -PORT_OFFSET },
      { x: 100 + PORT_OFFSET, y: 50 },
      { x: 50, y: 100 + PORT_OFFSET },
      { x: -PORT_OFFSET, y: 50 },
    ])
    expect(portAtScreen({ x: 100, y: 50 }, shape, camera)).toBeNull()
    expect(portAtScreen({ x: 100 + PORT_OFFSET, y: 50 }, shape, camera)).toEqual({ x: 100, y: 50 })
  })

  it('uses the area between the shape and connector control for hover only', () => {
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 100 })
    const camera = new Camera()
    const bridge = { x: 100 + PORT_OFFSET / 2 - 0.5, y: 50 }

    expect(portAtScreen(bridge, shape, camera)).toBeNull()
    expect(portHoverAtScreen(bridge, shape, camera)).toEqual({ x: 100, y: 50 })
    expect(portHoverAtScreen({ x: bridge.x, y: bridge.y + 13 }, shape, camera)).toBeNull()
  })

  it('keeps the connector offset stable in screen space across zoom levels', () => {
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 100 })
    const camera = new Camera({ x: 0, y: 0, zoom: 2 })

    const right = shapePortHandlesScreen(shape, camera)[1]

    expect(right?.anchor).toEqual({ x: 100, y: 50 })
    expect(right?.position).toEqual({ x: 200 + PORT_OFFSET, y: 100 })
    expect(portAtScreen({ x: 200 + PORT_OFFSET, y: 100 }, shape, camera)).toEqual({ x: 100, y: 50 })
    expect(portHandleWorld(shape, { x: 100, y: 50 }, camera)).toEqual({ x: 100 + PORT_OFFSET / 2, y: 50 })
  })

  it('places connector controls along rotated outward normals', () => {
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 })
    const camera = new Camera()

    const top = shapePortHandlesScreen(shape, camera)[0]

    expect(top?.anchor).toEqual({ x: 100, y: 50 })
    expect(top?.position).toEqual({ x: 100 + PORT_OFFSET, y: 50 })
  })
})
