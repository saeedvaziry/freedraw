import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { createArrow, createShape } from '../model/factory.js'
import type { Binding, ElementId } from '../model/types.js'
import { SceneStore, shallowEqual } from './scene-store.js'

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

describe('store selectors', () => {
  it('surfaces a new snapshot only when the selected slice changes', () => {
    const store = new SceneStore()
    const handle = store.select((s) => s.getUiState().selectedIds.size, {
      channels: ['selection', 'chrome'],
    })
    let last = handle.getSnapshot()
    let renders = 0
    handle.subscribe(() => {
      const next = handle.getSnapshot()
      if (!Object.is(next, last)) {
        renders += 1
        last = next
      }
    })

    store.setUiState({ activeTool: 'hand' })
    expect(renders).toBe(0)

    store.setUiState({ selectedIds: new Set(['a']) })
    expect(renders).toBe(1)
    expect(handle.getSnapshot()).toBe(1)
  })

  it('returns a stable snapshot reference while the selected slice is unchanged', () => {
    const store = new SceneStore()
    const handle = store.select((s) => ({ tool: s.getUiState().activeTool }), {
      equals: shallowEqual,
      channels: ['chrome'],
    })
    const first = handle.getSnapshot()

    store.setUiState({ clipboardElementCount: 1 })
    expect(handle.getSnapshot()).toBe(first)

    store.setUiState({ activeTool: 'hand' })
    expect(handle.getSnapshot()).not.toBe(first)
    expect(handle.getSnapshot().tool).toBe('hand')
  })
})

describe('store channels', () => {
  it('isolates hover changes from doc, selection, and chrome subscribers', () => {
    const store = new SceneStore()
    let doc = 0
    let selection = 0
    let chrome = 0
    let hover = 0
    store.subscribe(() => {
      doc += 1
    })
    store.subscribeSelection(() => {
      selection += 1
    })
    store.subscribeChrome(() => {
      chrome += 1
    })
    store.subscribeHover(() => {
      hover += 1
    })

    store.setHoveredId('shape-1')

    expect(hover).toBe(1)
    expect(doc).toBe(0)
    expect(selection).toBe(0)
    expect(chrome).toBe(0)
  })

  it('keeps selection changes off the hover and doc channels', () => {
    const store = new SceneStore()
    let doc = 0
    let hover = 0
    let selection = 0
    store.subscribe(() => {
      doc += 1
    })
    store.subscribeHover(() => {
      hover += 1
    })
    store.subscribeSelection(() => {
      selection += 1
    })

    store.setUiState({ selectedIds: new Set(['a']) })

    expect(selection).toBe(1)
    expect(hover).toBe(0)
    expect(doc).toBe(0)
  })

  it('routes setUiState hoveredId through the hover channel only', () => {
    const store = new SceneStore()
    let ui = 0
    let hover = 0
    store.subscribeUi(() => {
      ui += 1
    })
    store.subscribeHover(() => {
      hover += 1
    })

    store.setUiState({ hoveredId: 'shape-1' })

    expect(hover).toBe(1)
    expect(ui).toBe(0)
    expect(store.getHoveredId()).toBe('shape-1')
  })

  it('keeps hoveredId out of the shared ui-state snapshot', () => {
    const store = new SceneStore()
    const before = store.getUiState()

    store.setHoveredId('shape-1')

    expect(Object.hasOwn(store.getUiState(), 'hoveredId')).toBe(false)
    expect(store.getUiState()).toBe(before)
    expect(store.getHoveredId()).toBe('shape-1')
  })
})

describe('tool lock', () => {
  it('defaults toolLock to false', () => {
    const store = new SceneStore()
    expect(store.getUiState().toolLock).toBe(false)
  })

  it('updates toolLock and notifies chrome subscribers', () => {
    const store = new SceneStore()
    let chrome = 0
    let selection = 0
    store.subscribeChrome(() => {
      chrome += 1
    })
    store.subscribeSelection(() => {
      selection += 1
    })

    store.setUiState({ toolLock: true })

    expect(store.getUiState().toolLock).toBe(true)
    expect(chrome).toBe(1)
    expect(selection).toBe(0)
  })

  it('surfaces toolLock changes through the chrome channel selector', () => {
    const store = new SceneStore()
    const handle = store.select((s) => s.getUiState().toolLock, { channels: ['chrome'] })
    expect(handle.getSnapshot()).toBe(false)

    store.setUiState({ toolLock: true })
    expect(handle.getSnapshot()).toBe(true)
  })
})
