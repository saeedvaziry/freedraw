import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { createArrow, createShape } from '../model/factory.js'
import type { Binding, ElementId } from '../model/types.js'
import { SceneStore } from './scene-store.js'

const shapeAt = (id: string, x: number): ReturnType<typeof createShape> =>
  createShape({ id, type: 'rect', x, y: 0, width: 40, height: 40 })

const bindingTo = (elementId: string): Binding => ({
  elementId,
  anchor: { nx: 0.5, ny: 0.5 },
  gap: 0,
  side: 'right',
})

describe('binding index', () => {
  it('indexes arrows bound to shapes as they are added', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 200))
      api.addElement(
        createArrow({
          id: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
          ],
          start: bindingTo('a'),
          end: bindingTo('b'),
        }),
      )
    })

    expect([...store.arrowsForShape('a')]).toEqual(['arrow'])
    expect([...store.arrowsForShape('b')]).toEqual(['arrow'])
  })

  it('moves an arrow between shapes when its binding changes', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 200))
      api.addElement(
        createArrow({
          id: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
          ],
          start: bindingTo('a'),
        }),
      )
    })
    expect([...store.arrowsForShape('a')]).toEqual(['arrow'])

    store.transact((api) => api.updateElement('arrow', { start: bindingTo('b') }))

    expect([...store.arrowsForShape('a')]).toEqual([])
    expect([...store.arrowsForShape('b')]).toEqual(['arrow'])
  })

  it('drops arrows from the index when they are removed', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(
        createArrow({
          id: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
          ],
          start: bindingTo('a'),
        }),
      )
    })

    store.deleteElements(['arrow'])

    expect([...store.arrowsForShape('a')]).toEqual([])
  })

  it('cascades shape deletion to its bound arrows and clears the index', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(
        createArrow({
          id: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
          ],
          start: bindingTo('a'),
        }),
      )
    })

    store.deleteElements(['a'])

    expect(store.getSnapshot().elements.arrow).toBeUndefined()
    expect(store.getSnapshot().elements.a).toBeUndefined()
    expect([...store.arrowsForShape('a')]).toEqual([])
  })
})

describe('bulk delete', () => {
  it('preserves the order of remaining elements', () => {
    const store = new SceneStore()
    const ids: ElementId[] = ['a', 'b', 'c', 'd', 'e']
    store.transact((api) => ids.forEach((id, i) => api.addElement(shapeAt(id, i * 60))))

    store.deleteElements(['b', 'd'])

    expect(store.getSnapshot().order).toEqual(['a', 'c', 'e'])
    expect(Object.keys(store.getSnapshot().elements).sort()).toEqual(['a', 'c', 'e'])
  })

  it('is a single undo step', () => {
    const store = new SceneStore()
    const ids: ElementId[] = ['a', 'b', 'c', 'd', 'e']
    store.transact((api) => ids.forEach((id, i) => api.addElement(shapeAt(id, i * 60))))
    store.stopCapturing()

    store.deleteElements(['a', 'b', 'c'])
    store.stopCapturing()
    expect(store.getSnapshot().order).toEqual(['d', 'e'])

    store.undo()

    expect(store.getSnapshot().order).toEqual(ids)
  })
})

describe('local app state', () => {
  it('keeps camera out of the synced doc', () => {
    const store = new SceneStore()

    store.commitCamera({ x: 10, y: 20, zoom: 1.5 })

    expect(store.getSnapshot().appState.camera).toEqual({ x: 10, y: 20, zoom: 1.5 })
    expect(store.getLocalAppState().camera).toEqual({ x: 10, y: 20, zoom: 1.5 })
    expect(store.doc.getMap('appState').get('camera')).toBeUndefined()
    expect(store.canUndo).toBe(false)
  })

  it('keeps lastUsedStyle and snapGuides out of the synced doc', () => {
    const store = new SceneStore()

    store.updateLastUsedStyle({ stroke: '#abcdef' })
    store.setSnapGuidesEnabled(false)

    expect(store.getLastUsedStyle().stroke).toBe('#abcdef')
    expect(store.getSnapshot().appState.snapGuidesEnabled).toBe(false)
    expect(store.doc.getMap('appState').get('lastUsedStyle')).toBeUndefined()
    expect(store.doc.getMap('appState').get('snapGuidesEnabled')).toBeUndefined()
  })

  it('seeds local state from an existing document', () => {
    const doc = new Y.Doc()
    doc.getMap('appState').set('camera', { x: 5, y: 6, zoom: 2 })
    doc.getMap('appState').set('snapGuidesEnabled', false)

    const store = new SceneStore(doc)

    expect(store.getSnapshot().appState.camera).toEqual({ x: 5, y: 6, zoom: 2 })
    expect(store.getLocalAppState().snapGuidesEnabled).toBe(false)
  })

  it('hydrates local state and reflects it in the snapshot', () => {
    const store = new SceneStore()

    store.hydrateLocalAppState({ camera: { x: 3, y: 4, zoom: 0.5 }, snapGuidesEnabled: false })

    expect(store.getSnapshot().appState.camera).toEqual({ x: 3, y: 4, zoom: 0.5 })
    expect(store.getSnapshot().appState.snapGuidesEnabled).toBe(false)
  })

  it('notifies local-state subscribers only for local changes', () => {
    const store = new SceneStore()
    let localCalls = 0
    store.subscribeLocalState(() => {
      localCalls += 1
    })

    store.transact((api) => api.addElement(shapeAt('a', 0)))
    expect(localCalls).toBe(0)

    store.commitCamera({ x: 1, y: 2, zoom: 1 })
    store.updateLastUsedStyle({ stroke: '#111111' })
    store.setSnapGuidesEnabled(false)
    expect(localCalls).toBe(3)
  })

  it('still notifies scene subscribers so chrome re-renders on camera commit', () => {
    const store = new SceneStore()
    let sceneCalls = 0
    store.subscribe(() => {
      sceneCalls += 1
    })

    store.commitCamera({ x: 1, y: 2, zoom: 1 })

    expect(sceneCalls).toBeGreaterThan(0)
  })
})
