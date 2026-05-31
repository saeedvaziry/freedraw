import { describe, expect, it } from 'vitest'
import { Camera, MAX_ZOOM, MIN_ZOOM } from './Camera.js'
import { intersects } from './rect.js'

describe('Camera', () => {
  it('round-trips world->screen->world', () => {
    const camera = new Camera({ x: 120, y: -40, zoom: 1.75 })
    const world = { x: 333, y: 222 }
    const screen = camera.worldToScreen(world)
    const back = camera.screenToWorld(screen)
    expect(back.x).toBeCloseTo(world.x, 6)
    expect(back.y).toBeCloseTo(world.y, 6)
  })

  it('keeps the cursor point fixed when zooming', () => {
    const camera = new Camera({ x: 0, y: 0, zoom: 1 })
    const cursor = { x: 400, y: 300 }
    const worldBefore = camera.screenToWorld(cursor)
    camera.zoomToScreenPoint(3, cursor)
    const worldAfter = camera.screenToWorld(cursor)
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6)
  })

  it('clamps zoom to the configured bounds', () => {
    const camera = new Camera()
    camera.zoomToScreenPoint(100, { x: 0, y: 0 })
    expect(camera.zoom).toBe(MAX_ZOOM)
    camera.zoomToScreenPoint(0.001, { x: 0, y: 0 })
    expect(camera.zoom).toBe(MIN_ZOOM)
  })

  it('computes a viewport world rect used for culling', () => {
    const camera = new Camera({ x: 100, y: 100, zoom: 2 })
    const viewport = camera.viewportWorldRect(800, 600)
    expect(viewport).toEqual({ x: 100, y: 100, width: 400, height: 300 })

    expect(intersects({ x: 200, y: 200, width: 50, height: 50 }, viewport)).toBe(true)
    expect(intersects({ x: 1000, y: 1000, width: 10, height: 10 }, viewport)).toBe(false)
  })
})
