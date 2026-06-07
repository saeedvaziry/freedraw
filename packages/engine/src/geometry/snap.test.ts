import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { snapEndpoint } from './snap.js'

function snapshotOf(elements: Element[]): SceneSnapshot {
  const map: Record<string, Element> = {}
  elements.forEach((element) => {
    map[element.id] = element
  })
  return {
    elements: map,
    order: elements.map((e) => e.id),
    appState: {
      schemaVersion: 1,
      camera: { x: 0, y: 0, zoom: 1 },
      lastUsedStyle: {} as never,
      snapGuidesEnabled: true,
    },
  }
}

describe('snapEndpoint', () => {
  it('binds when the pointer is anywhere over a shape, snapping to the nearest edge surface', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 180, y: 50 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 200, y: 50 })
  })

  it('binds to any point along a rectangle edge', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 180, y: 32 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 200, y: 32 })
  })

  it('keeps a weak magnet to edge centers', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 198, y: 52 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 200, y: 50 })
  })

  it('does not over-magnetize edge centers', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 198, y: 56 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point.x).toBeCloseTo(200)
    expect(result.point.y).toBeCloseTo(56)
  })

  it('magnetizes to a shape edge before the pointer enters the shape', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 206, y: 62 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 200, y: 62 })
  })

  it('does not magnetize to shape edges outside the snap distance', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 212, y: 62 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target).toBeNull()
    expect(result.point).toEqual({ x: 210, y: 60 })
  })

  it('binds from deep inside the shape to the nearest edge port', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 100, y: 10 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 100, y: 0 })
  })

  it('binds when the pointer is on the visible stroke outside the fill bounds', () => {
    const rect = createShape({
      id: 'r',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      style: { fill: '#fff', strokeWidth: 20 },
    })
    const result = snapEndpoint({ x: 205, y: 50 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 200, y: 50 })
  })

  it('does not bind on empty canvas', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 400, y: 400 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target).toBeNull()
    expect(result.point).toEqual({ x: 400, y: 400 })
  })

  it('snaps empty canvas endpoints to half-grid guides', () => {
    const result = snapEndpoint({ x: 407, y: 392 }, snapshotOf([]), { threshold: 8 })
    expect(result.target).toBeNull()
    expect(result.point).toEqual({ x: 405, y: 390 })
  })

  it('keeps free endpoints horizontal when close to the origin axis', () => {
    const result = snapEndpoint({ x: 192, y: 66 }, snapshotOf([]), {
      threshold: 2,
      origin: { x: 100, y: 63 },
    })
    expect(result.point).toEqual({ x: 190, y: 63 })
  })

  it('keeps long horizontal endpoint drags on axis despite modest pointer drift', () => {
    const result = snapEndpoint({ x: 100, y: 238 }, snapshotOf([]), {
      threshold: 2,
      origin: { x: 600, y: 213 },
    })
    expect(result.point).toEqual({ x: 100, y: 213 })
  })

  it('keeps free endpoints vertical when close to the origin axis', () => {
    const result = snapEndpoint({ x: 66, y: 192 }, snapshotOf([]), {
      threshold: 2,
      origin: { x: 63, y: 100 },
    })
    expect(result.point).toEqual({ x: 63, y: 190 })
  })

  it('ignores the dragged arrow itself', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 100, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 50, y: 50 }, snapshotOf([rect]), { threshold: 8, ignoreId: 'r' })
    expect(result.target).toBeNull()
  })
})
