import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import type { ArrowElement, Element } from '../model/types.js'
import { SceneStore } from '../store/SceneStore.js'
import { spawnConnectedShape } from './spawn.js'

function nonSource(store: SceneStore, sourceId: string): Element[] {
  return Object.values(store.getSnapshot().elements).filter((element) => element.id !== sourceId)
}

describe('spawnConnectedShape', () => {
  it('creates a shape to the right and a bound arrow, selecting the new shape', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'src', x: 0, y: 0, width: 100, height: 100 })
    store.transact((api) => api.addElement(source))
    store.stopCapturing()

    const newId = spawnConnectedShape(store, source, 'right')
    const created = nonSource(store, 'src')
    const shape = created.find((element) => element.id === newId)!
    const arrow = created.find((element) => element.type === 'arrow') as ArrowElement

    expect(shape.x).toBeGreaterThan(100)
    expect(shape.y).toBe(0)
    expect(arrow.start?.elementId).toBe('src')
    expect(arrow.end?.elementId).toBe(newId)
    expect([...store.getUiState().selectedIds]).toEqual([newId])
  })

  it('branches perpendicular when spawning twice in the same direction', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'src', x: 0, y: 0, width: 100, height: 100 })
    store.transact((api) => api.addElement(source))
    store.stopCapturing()

    const firstId = spawnConnectedShape(store, source, 'right')
    const first = store.getSnapshot().elements[firstId]!

    const obstacles = Object.values(store.getSnapshot().elements)
      .filter((element) => element.id !== source.id && element.type !== 'arrow')
      .map((element) => ({ x: element.x, y: element.y, width: element.width, height: element.height }))
    const secondId = spawnConnectedShape(store, source, 'right', undefined, obstacles)
    const second = store.getSnapshot().elements[secondId]!

    expect(second.x).toBe(first.x)
    expect(Math.abs(second.y - first.y)).toBeGreaterThanOrEqual(first.height)

    const arrow = Object.values(store.getSnapshot().elements).find(
      (element) => element.type === 'arrow' && (element as ArrowElement).end?.elementId === secondId,
    ) as ArrowElement
    expect(arrow.route.length).toBeGreaterThan(2)
  })

  it('spawns upward for the up direction', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'src', x: 0, y: 200, width: 100, height: 100 })
    store.transact((api) => api.addElement(source))
    const newId = spawnConnectedShape(store, source, 'up')
    expect(store.getSnapshot().elements[newId]!.y).toBeLessThan(200)
  })

  it('gives the bound arrow the last used style', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'src', x: 0, y: 0, width: 100, height: 100 })
    store.transact((api) => api.addElement(source))
    store.updateLastUsedStyle({ sloppiness: 0.8 })
    store.stopCapturing()

    spawnConnectedShape(store, source, 'right')
    const arrow = nonSource(store, 'src').find((element) => element.type === 'arrow') as ArrowElement

    expect(arrow.style.sloppiness).toBe(0.8)
  })

  it('is a single undo step', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'src', x: 0, y: 0, width: 100, height: 100 })
    store.transact((api) => api.addElement(source))
    store.stopCapturing()

    spawnConnectedShape(store, source, 'right')
    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(3)
    store.undo()
    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(1)
  })
})
