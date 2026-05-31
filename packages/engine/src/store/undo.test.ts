import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import { SceneStore } from './SceneStore.js'

function seed(store: SceneStore, id = 'a'): void {
  store.transact((api) => api.addElement(createShape({ id, x: 0, y: 0, width: 100, height: 60 })))
  store.stopCapturing()
}

describe('UndoManager', () => {
  it('undoes and redoes a move as one step', () => {
    const store = new SceneStore()
    seed(store)

    store.stopCapturing()
    store.transact((api) => api.updateElement('a', { x: 10 }))
    store.transact((api) => api.updateElement('a', { x: 20 }))
    store.transact((api) => api.updateElement('a', { x: 30 }))
    store.stopCapturing()

    expect(store.getSnapshot().elements.a?.x).toBe(30)
    store.undo()
    expect(store.getSnapshot().elements.a?.x).toBe(0)
    store.redo()
    expect(store.getSnapshot().elements.a?.x).toBe(30)
  })

  it('undoes a resize as one step', () => {
    const store = new SceneStore()
    seed(store)

    store.stopCapturing()
    store.transact((api) => api.updateElement('a', { width: 200, height: 120 }))
    store.stopCapturing()

    store.undo()
    expect(store.getSnapshot().elements.a).toMatchObject({ width: 100, height: 60 })
  })

  it('undoes a rotate as one step', () => {
    const store = new SceneStore()
    seed(store)

    store.stopCapturing()
    store.transact((api) => api.updateElement('a', { rotation: 1 }))
    store.stopCapturing()

    store.undo()
    expect(store.getSnapshot().elements.a?.rotation).toBe(0)
  })

  it('undoes a delete, restoring the element', () => {
    const store = new SceneStore()
    seed(store)

    store.deleteElements(['a'])
    expect(store.getSnapshot().elements.a).toBeUndefined()

    store.undo()
    expect(store.getSnapshot().elements.a).toMatchObject({ id: 'a', x: 0 })
  })

  it('undoes a duplicate, removing the clones', () => {
    const store = new SceneStore()
    seed(store)

    const clones = store.duplicateElements(['a'])
    expect(clones).toHaveLength(1)
    expect(store.getSnapshot().order).toHaveLength(2)

    store.undo()
    expect(store.getSnapshot().order).toHaveLength(1)
  })

  it('undoes a multi-element move in a single step', () => {
    const store = new SceneStore()
    seed(store, 'a')
    store.transact((api) => api.addElement(createShape({ id: 'b', x: 200, y: 0, width: 50, height: 50 })))
    store.stopCapturing()

    store.transact((api) => {
      api.updateElement('a', { x: 5 })
      api.updateElement('b', { x: 205 })
    })
    store.stopCapturing()

    store.undo()
    expect(store.getSnapshot().elements.a?.x).toBe(0)
    expect(store.getSnapshot().elements.b?.x).toBe(200)
    expect(store.canUndo).toBe(true)
  })

  it('reports canUndo/canRedo transitions', () => {
    const store = new SceneStore()
    expect(store.canUndo).toBe(false)
    seed(store)
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(false)
    store.undo()
    expect(store.canRedo).toBe(true)
  })
})
