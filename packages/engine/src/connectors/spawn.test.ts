import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import type { ArrowElement, SceneSnapshot } from '../model/types.js'
import { isArrowElement } from '../model/guards.js'
import { intersects } from '../geometry/rect.js'
import { elementBounds } from '../geometry/hit-test.js'
import { SceneStore } from '../store/scene-store.js'
import { inferSpawnDirection, spawnConnectedShape, spawnSiblingShape } from './spawn.js'

function arrowsIn(snapshot: SceneSnapshot): ArrowElement[] {
  return snapshot.order.map((id) => snapshot.elements[id]!).filter(isArrowElement)
}

describe('spawnSiblingShape', () => {
  it('adds a sibling shape plus a connecting arrow from the parent', () => {
    const store = new SceneStore()
    const parent = createShape({ id: 'parent', x: 0, y: 0, width: 100, height: 60 })
    store.transact((api) => api.addElement(parent))
    const childId = spawnConnectedShape(store, parent, 'right')
    const child = store.getSnapshot().elements[childId]!

    const before = store.getSnapshot().order.length
    const siblingId = spawnSiblingShape(store, parent, child)
    const snapshot = store.getSnapshot()
    const sibling = snapshot.elements[siblingId]!

    expect(snapshot.order.length).toBe(before + 2)
    expect(isArrowElement(sibling)).toBe(false)

    const connector = arrowsIn(snapshot).find(
      (arrow) => arrow.start?.elementId === parent.id && arrow.end?.elementId === siblingId,
    )
    expect(connector).toBeTruthy()
  })

  it('places the sibling in the next free lane without overlapping the existing child', () => {
    const store = new SceneStore()
    const parent = createShape({ id: 'parent', x: 0, y: 0, width: 100, height: 60 })
    store.transact((api) => api.addElement(parent))
    const childId = spawnConnectedShape(store, parent, 'right')
    const child = store.getSnapshot().elements[childId]!

    const siblingId = spawnSiblingShape(store, parent, child)
    const sibling = store.getSnapshot().elements[siblingId]!

    expect(intersects(elementBounds(sibling), elementBounds(child))).toBe(false)
  })

  it('connects the sibling to the parent from the same side as the child', () => {
    const store = new SceneStore()
    const parent = createShape({ id: 'parent', x: 0, y: 0, width: 100, height: 60 })
    store.transact((api) => api.addElement(parent))
    const childId = spawnConnectedShape(store, parent, 'down')
    const child = store.getSnapshot().elements[childId]!
    expect(inferSpawnDirection(parent, child)).toBe('down')

    const siblingId = spawnSiblingShape(store, parent, child)
    const snapshot = store.getSnapshot()
    const sibling = snapshot.elements[siblingId]!

    const childArrow = arrowsIn(snapshot).find(
      (arrow) => arrow.start?.elementId === parent.id && arrow.end?.elementId === childId,
    )
    const siblingArrow = arrowsIn(snapshot).find(
      (arrow) => arrow.start?.elementId === parent.id && arrow.end?.elementId === siblingId,
    )
    expect(childArrow?.start?.side).toBe('bottom')
    expect(siblingArrow?.start?.side).toBe(childArrow?.start?.side)
    expect(intersects(elementBounds(sibling), elementBounds(child))).toBe(false)
  })

  it('inherits the shape type of a plain-shape child', () => {
    const store = new SceneStore()
    const parent = createShape({ id: 'parent', type: 'ellipse', x: 0, y: 0, width: 100, height: 60 })
    store.transact((api) => api.addElement(parent))
    const childId = spawnConnectedShape(store, parent, 'right', 'diamond')
    const child = store.getSnapshot().elements[childId]!

    const siblingId = spawnSiblingShape(store, parent, child)
    const sibling = store.getSnapshot().elements[siblingId]!

    expect(sibling.type).toBe('diamond')
  })
})
