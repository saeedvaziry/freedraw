import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createBinding } from '../connectors/binding.js'
import { createArrow, createShape } from '../model/factory.js'
import { SceneStore } from '../store/SceneStore.js'
import type { ArrowElement } from './types.js'
import { applyScene, isValidScene, serializeScene } from './serialize.js'
import { seedAppState } from './migrations.js'

function allAxisAligned(points: { x: number; y: number }[]): boolean {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return false
  }
  return true
}

function seededStore(): SceneStore {
  const store = new SceneStore()
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
  store.commitCamera({ x: 42, y: -17, zoom: 1.5 })
  return store
}

describe('serialize round-trip', () => {
  it('reproduces elements, order and appState through a fresh doc', () => {
    const source = seededStore()
    const scene = serializeScene(source.getSnapshot())

    const target = new Y.Doc()
    applyScene(target, scene)
    const restored = new SceneStore(target)

    expect(restored.getSnapshot().elements).toEqual(source.getSnapshot().elements)
    expect(restored.getSnapshot().order).toEqual(source.getSnapshot().order)
    expect(restored.getSnapshot().appState).toEqual(source.getSnapshot().appState)
  })

  it('restores the camera from persisted appState', () => {
    const source = seededStore()
    const target = new Y.Doc()
    applyScene(target, serializeScene(source.getSnapshot()))
    const restored = new SceneStore(target)
    expect(restored.getSnapshot().appState.camera).toEqual({ x: 42, y: -17, zoom: 1.5 })
  })

  it('rebuilds the binding index after hydrate so bound arrows resolve', () => {
    const source = seededStore()
    const target = new Y.Doc()
    applyScene(target, serializeScene(source.getSnapshot()))
    const restored = new SceneStore(target)
    expect([...restored.arrowsForShape('a')]).toEqual(['arr'])
    expect([...restored.arrowsForShape('b')]).toEqual(['arr'])

    restored.transact((api) => api.updateElement('b', { x: 300, y: 300 }))
    const arrow = restored.getSnapshot().elements.arr as ArrowElement
    const route = arrow.route
    expect(route[route.length - 1]!.y).toBeGreaterThan(150)
  })

  it('normalizes diagonal persisted arrows before the first snapshot', () => {
    const source = new SceneStore()
    const arrow = createArrow({
      id: 'arr',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 40 },
        { x: 180, y: 10 },
      ],
    })
    source.transact((api) => api.addElement(arrow))
    const scene = serializeScene(source.getSnapshot())
    scene.elements.arr = {
      ...(scene.elements.arr as ArrowElement),
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 40 },
        { x: 180, y: 10 },
      ],
    }

    const target = new Y.Doc()
    applyScene(target, scene)
    const restored = new SceneStore(target)
    const restoredArrow = restored.getSnapshot().elements.arr as ArrowElement
    expect(allAxisAligned(restoredArrow.route)).toBe(true)
  })
})

describe('isValidScene', () => {
  it('accepts a well-formed doc', () => {
    const source = seededStore()
    const target = new Y.Doc()
    applyScene(target, serializeScene(source.getSnapshot()))
    expect(isValidScene(target)).toBe(true)
  })

  it('accepts an empty fresh doc', () => {
    const doc = new Y.Doc()
    seedAppState(doc)
    expect(isValidScene(doc)).toBe(true)
  })

  it('rejects an element missing required fields (corrupt data)', () => {
    const doc = new Y.Doc()
    const broken = new Y.Map<unknown>()
    broken.set('id', 'x')
    doc.getMap('elements').set('x', broken)
    expect(isValidScene(doc)).toBe(false)
  })

  it('rejects an element stored as a non-map', () => {
    const doc = new Y.Doc()
    doc.getMap('elements').set('x', 'not-an-element' as unknown as Y.Map<unknown>)
    expect(isValidScene(doc)).toBe(false)
  })
})
