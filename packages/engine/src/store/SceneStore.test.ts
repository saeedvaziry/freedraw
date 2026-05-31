import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import { SceneStore } from './SceneStore.js'

describe('SceneStore', () => {
  it('mirrors added elements and sets the dirty flag', () => {
    const store = new SceneStore()
    store.needsRender = false

    const shape = createShape({ id: 'a', x: 10, y: 20, width: 30, height: 40 })
    store.transact((api) => api.addElement(shape))

    const snapshot = store.getSnapshot()
    expect(snapshot.elements.a).toMatchObject({ id: 'a', x: 10, width: 30 })
    expect(snapshot.order).toContain('a')
    expect(store.needsRender).toBe(true)
  })

  it('notifies subscribers on mutation', () => {
    const store = new SceneStore()
    let count = 0
    store.subscribe(() => {
      count += 1
    })
    store.transact((api) => api.addElement(createShape({ id: 'b', x: 0, y: 0, width: 1, height: 1 })))
    expect(count).toBeGreaterThan(0)
  })

  it('reflects field updates in the mirror', () => {
    const store = new SceneStore()
    store.transact((api) => api.addElement(createShape({ id: 'c', x: 0, y: 0, width: 10, height: 10 })))
    store.transact((api) => api.updateElement('c', { x: 99 }))
    expect(store.getSnapshot().elements.c?.x).toBe(99)
  })

  it('removes elements from the mirror and order', () => {
    const store = new SceneStore()
    store.transact((api) => api.addElement(createShape({ id: 'd', x: 0, y: 0, width: 10, height: 10 })))
    store.transact((api) => api.removeElement('d'))
    expect(store.getSnapshot().elements.d).toBeUndefined()
    expect(store.getSnapshot().order).not.toContain('d')
  })

  it('keeps ui state separate from the synced snapshot', () => {
    const store = new SceneStore()
    let uiCount = 0
    store.subscribeUi(() => {
      uiCount += 1
    })
    store.setUiState({ hoveredId: 'x' })
    expect(store.getUiState().hoveredId).toBe('x')
    expect(uiCount).toBe(1)
  })

  it('updates the camera through appState', () => {
    const store = new SceneStore()
    store.commitCamera({ x: 5, y: 6, zoom: 2 })
    expect(store.getSnapshot().appState.camera).toEqual({ x: 5, y: 6, zoom: 2 })
  })

  it('does not record camera commits in undo history', () => {
    const store = new SceneStore()
    store.commitCamera({ x: 5, y: 6, zoom: 2 })
    expect(store.canUndo).toBe(false)
  })
})
