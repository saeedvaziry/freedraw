import { describe, expect, it } from 'vitest'
import { createBinding } from '../connectors/binding.js'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement } from '../model/types.js'
import { SceneStore } from './SceneStore.js'

function seedBound(store: SceneStore) {
  const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
  const b = createShape({ id: 'b', x: 300, y: 0, width: 100, height: 100 })
  const arrow = createArrow({
    id: 'arr',
    points: [
      { x: 100, y: 50 },
      { x: 300, y: 50 },
    ],
    start: createBinding(a, { x: 100, y: 50 }, 0),
    end: createBinding(b, { x: 300, y: 50 }, 0),
  })
  store.transact((api) => {
    api.addElement(a)
    api.addElement(b)
    api.addElement(arrow)
  })
  store.stopCapturing()
  return { a, b, arrow }
}

function arrowPoints(store: SceneStore, id: string) {
  return (store.getSnapshot().elements[id] as ArrowElement).points
}

describe('binding index + recompute', () => {
  it('indexes arrows by the shapes they bind to', () => {
    const store = new SceneStore()
    seedBound(store)
    expect([...store.arrowsForShape('a')]).toEqual(['arr'])
    expect([...store.arrowsForShape('b')]).toEqual(['arr'])
  })

  it('recomputes the bound endpoint when a shape moves', () => {
    const store = new SceneStore()
    seedBound(store)
    store.transact((api) => api.updateElement('b', { x: 300, y: 200 }))
    const points = arrowPoints(store, 'arr')
    const end = points[points.length - 1]!
    expect(end.y).toBeGreaterThan(150)
  })

  it('stays attached after a resize', () => {
    const store = new SceneStore()
    seedBound(store)
    store.transact((api) => api.updateElement('b', { width: 200 }))
    const points = arrowPoints(store, 'arr')
    const end = points[points.length - 1]!
    expect(end.x).toBeCloseTo(300)
  })

  it('stays attached after a rotate', () => {
    const store = new SceneStore()
    seedBound(store)
    store.transact((api) => api.updateElement('a', { rotation: Math.PI / 4 }))
    const points = arrowPoints(store, 'arr')
    expect(Number.isFinite(points[0]!.x)).toBe(true)
    expect(Number.isFinite(points[0]!.y)).toBe(true)
  })

  it('cascade-deletes bound arrows in one undo step', () => {
    const store = new SceneStore()
    seedBound(store)
    store.deleteElements(['a'])
    expect(store.getSnapshot().elements.a).toBeUndefined()
    expect(store.getSnapshot().elements.arr).toBeUndefined()
    expect(store.getSnapshot().elements.b).toBeDefined()

    store.undo()
    expect(store.getSnapshot().elements.a).toBeDefined()
    expect(store.getSnapshot().elements.arr).toBeDefined()
  })

  it('move + arrow recompute is a single undo step', () => {
    const store = new SceneStore()
    seedBound(store)
    store.transact((api) => api.updateElement('b', { x: 300, y: 300 }))
    store.stopCapturing()
    store.undo()
    expect(store.getSnapshot().elements.b?.y).toBe(0)
    const points = arrowPoints(store, 'arr')
    expect(points[points.length - 1]!.y).toBeCloseTo(50)
  })
})
