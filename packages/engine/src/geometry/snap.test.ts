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
    appState: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, lastUsedStyle: {} as never },
  }
}

describe('snapEndpoint', () => {
  it('binds when the pointer is anywhere over a shape, snapping to the nearest edge port', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 180, y: 50 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 200, y: 50 })
  })

  it('binds from deep inside the shape to the nearest edge port', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 200, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 100, y: 10 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target?.id).toBe('r')
    expect(result.point).toEqual({ x: 100, y: 0 })
  })

  it('does not bind on empty canvas', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 400, y: 400 }, snapshotOf([rect]), { threshold: 8 })
    expect(result.target).toBeNull()
    expect(result.point).toEqual({ x: 400, y: 400 })
  })

  it('ignores the dragged arrow itself', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 100, height: 100, style: { fill: '#fff' } })
    const result = snapEndpoint({ x: 50, y: 50 }, snapshotOf([rect]), { threshold: 8, ignoreId: 'r' })
    expect(result.target).toBeNull()
  })
})
