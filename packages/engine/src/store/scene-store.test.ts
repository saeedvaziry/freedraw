import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { createArrow, createShape } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import { selectionBounds } from '../geometry/hit-test.js'
import type { Binding, ElementId } from '../model/types.js'
import { SceneStore, shallowEqual } from './scene-store.js'
import { buildStencil } from './stencil.js'

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

describe('grouping', () => {
  it('assigns a shared groupId to at least two elements', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 60))
    })

    const groupId = store.groupElements(['a', 'b'])

    expect(groupId).not.toBeNull()
    expect(store.getSnapshot().elements.a?.groupId).toBe(groupId)
    expect(store.getSnapshot().elements.b?.groupId).toBe(groupId)
  })

  it('refuses to group a single element', () => {
    const store = new SceneStore()
    store.transact((api) => api.addElement(shapeAt('a', 0)))

    expect(store.groupElements(['a'])).toBeNull()
    expect(store.getSnapshot().elements.a?.groupId).toBeUndefined()
  })

  it('ungroups every member when any member is passed', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 60))
    })
    store.groupElements(['a', 'b'])

    store.ungroupElements(['a'])

    expect(store.getSnapshot().elements.a?.groupId).toBeUndefined()
    expect(store.getSnapshot().elements.b?.groupId).toBeUndefined()
  })
})

describe('lock', () => {
  it('locks and deselects the given elements', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 60))
    })
    store.setUiState({ selectedIds: new Set(['a', 'b']) })

    store.lockElements(['a', 'b'])

    expect(store.getSnapshot().elements.a?.locked).toBe(true)
    expect(store.getSnapshot().elements.b?.locked).toBe(true)
    expect(store.getUiState().selectedIds.size).toBe(0)
  })

  it('unlocks every locked element in the scene', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 60))
    })
    store.lockElements(['a'])

    store.unlockAll()

    expect(store.getSnapshot().elements.a?.locked).toBe(false)
  })
})

describe('z-order', () => {
  const seed = (): SceneStore => {
    const store = new SceneStore()
    store.transact((api) => ['a', 'b', 'c', 'd'].forEach((id, i) => api.addElement(shapeAt(id, i * 60))))
    return store
  }

  it('brings selected elements to the front', () => {
    const store = seed()
    store.bringToFront(['a'])
    expect(store.getSnapshot().order).toEqual(['b', 'c', 'd', 'a'])
  })

  it('sends selected elements to the back', () => {
    const store = seed()
    store.sendToBack(['d'])
    expect(store.getSnapshot().order).toEqual(['d', 'a', 'b', 'c'])
  })

  it('brings a block forward one step keeping it together', () => {
    const store = seed()
    store.bringForward(['a', 'b'])
    expect(store.getSnapshot().order).toEqual(['c', 'a', 'b', 'd'])
  })

  it('sends a block backward one step keeping it together', () => {
    const store = seed()
    store.sendBackward(['c', 'd'])
    expect(store.getSnapshot().order).toEqual(['a', 'c', 'd', 'b'])
  })

  it('does not create an undo step when order is unchanged', () => {
    const store = seed()
    store.stopCapturing()
    let history = 0
    store.subscribeHistory(() => {
      history += 1
    })

    store.bringToFront(['a', 'b', 'c', 'd'])

    expect(history).toBe(0)
    expect(store.getSnapshot().order).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('align and distribute', () => {
  it('aligns left edges of selected shapes', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 100))
      api.addElement(shapeAt('c', 40))
    })

    store.alignElements(['a', 'b', 'c'], 'left')

    expect(store.getSnapshot().elements.a?.x).toBe(0)
    expect(store.getSnapshot().elements.b?.x).toBe(0)
    expect(store.getSnapshot().elements.c?.x).toBe(0)
  })

  it('distributes shapes so gaps are equal', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 30))
      api.addElement(shapeAt('c', 200))
    })

    store.distributeElements(['a', 'b', 'c'], 'horizontal')

    const { elements } = store.getSnapshot()
    const gapAB = elements.b!.x - (elements.a!.x + elements.a!.width)
    const gapBC = elements.c!.x - (elements.b!.x + elements.b!.width)
    expect(gapAB).toBeCloseTo(gapBC)
  })
})

describe('insertStencil', () => {
  const buildBoundSource = (): SceneStore => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 200))
      api.addElement(
        createArrow({
          id: 'arrow',
          points: [
            { x: 40, y: 20 },
            { x: 200, y: 20 },
          ],
          start: bindingTo('a'),
          end: bindingTo('b'),
        }),
      )
    })
    return store
  }

  const buildShapesSource = (): SceneStore => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(shapeAt('a', 0))
      api.addElement(shapeAt('b', 200))
    })
    return store
  }

  it('remaps ids and selects the inserted elements', () => {
    const stencil = buildStencil(buildBoundSource().getSnapshot(), ['a', 'b', 'arrow'])
    expect(stencil).not.toBeNull()

    const store = new SceneStore()
    const ids = store.insertStencil(stencil!, { x: 0, y: 0 })

    expect(ids).toHaveLength(3)
    for (const id of ids) {
      expect(['a', 'b', 'arrow']).not.toContain(id)
      expect(store.getSnapshot().elements[id]).toBeDefined()
    }
    expect(store.getUiState().selectedIds).toEqual(new Set(ids))
  })

  it('rebinds arrows within the stencil to the cloned shape ids', () => {
    const stencil = buildStencil(buildBoundSource().getSnapshot(), ['a', 'b', 'arrow'])!

    const store = new SceneStore()
    const ids = store.insertStencil(stencil, { x: 0, y: 0 })
    const inserted = new Set(ids)
    const arrow = ids.map((id) => store.getSnapshot().elements[id]!).find(isArrowElement)

    expect(arrow).toBeDefined()
    expect(arrow!.start?.elementId).not.toBe('a')
    expect(arrow!.end?.elementId).not.toBe('b')
    expect(inserted.has(arrow!.start!.elementId)).toBe(true)
    expect(inserted.has(arrow!.end!.elementId)).toBe(true)
  })

  it('centers the stencil on a target point', () => {
    const stencil = buildStencil(buildShapesSource().getSnapshot(), ['a', 'b'])!

    const store = new SceneStore()
    const ids = store.insertStencil(stencil, { x: 500, y: 300 })
    const bounds = selectionBounds(ids.map((id) => store.getSnapshot().elements[id]!))

    expect(bounds).not.toBeNull()
    expect(bounds!.x + bounds!.width / 2).toBeCloseTo(500)
    expect(bounds!.y + bounds!.height / 2).toBeCloseTo(300)
  })

  it('centers the stencil on a target rect center', () => {
    const stencil = buildStencil(buildShapesSource().getSnapshot(), ['a', 'b'])!

    const store = new SceneStore()
    const ids = store.insertStencil(stencil, { x: 100, y: 100, width: 200, height: 60 })
    const bounds = selectionBounds(ids.map((id) => store.getSnapshot().elements[id]!))

    expect(bounds!.x + bounds!.width / 2).toBeCloseTo(200)
    expect(bounds!.y + bounds!.height / 2).toBeCloseTo(130)
  })

  it('inserts as a single undo step', () => {
    const stencil = buildStencil(buildBoundSource().getSnapshot(), ['a', 'b', 'arrow'])!

    const store = new SceneStore()
    const ids = store.insertStencil(stencil, { x: 0, y: 0 })
    expect(store.getSnapshot().order).toHaveLength(3)

    store.undo()

    for (const id of ids) {
      expect(store.getSnapshot().elements[id]).toBeUndefined()
    }
    expect(store.getSnapshot().order).toHaveLength(0)
  })
})

describe('slides', () => {
  const rect = { x: 0, y: 0, width: 1280, height: 720 }

  it('adds a slide to the synced app state and surfaces it', () => {
    const store = new SceneStore()

    const id = store.addSlide(rect)

    const slides = store.getSnapshot().appState.slides
    expect(slides).toHaveLength(1)
    expect(slides[0]).toEqual({ id, name: 'Slide 1', rect, order: 0 })
    expect(store.getSlides()).toEqual(slides)
    expect(store.doc.getMap('appState').get('slides')).toHaveLength(1)
  })

  it('uses a provided name and appends with incrementing order', () => {
    const store = new SceneStore()

    store.addSlide(rect, 'Intro')
    store.addSlide({ x: 100, y: 0, width: 640, height: 360 })

    const slides = store.getSlides()
    expect(slides.map((slide) => slide.name)).toEqual(['Intro', 'Slide 2'])
    expect(slides.map((slide) => slide.order)).toEqual([0, 1])
  })

  it('renames a slide by id', () => {
    const store = new SceneStore()
    const id = store.addSlide(rect)

    store.renameSlide(id, 'Overview')

    expect(store.getSlides()[0]?.name).toBe('Overview')
  })

  it('deletes a slide and re-sequences the remaining order', () => {
    const store = new SceneStore()
    const a = store.addSlide(rect, 'A')
    const b = store.addSlide(rect, 'B')
    const c = store.addSlide(rect, 'C')

    store.deleteSlide(b)

    const slides = store.getSlides()
    expect(slides.map((slide) => slide.id)).toEqual([a, c])
    expect(slides.map((slide) => slide.order)).toEqual([0, 1])
  })

  it('reorders slides to match the given sequence', () => {
    const store = new SceneStore()
    const a = store.addSlide(rect, 'A')
    const b = store.addSlide(rect, 'B')
    const c = store.addSlide(rect, 'C')

    store.reorderSlides([c, a, b])

    const slides = store.getSlides()
    expect(slides.map((slide) => slide.id)).toEqual([c, a, b])
    expect(slides.map((slide) => slide.order)).toEqual([0, 1, 2])
  })

  it('reverts an added slide on undo', () => {
    const store = new SceneStore()
    store.addSlide(rect)
    expect(store.getSlides()).toHaveLength(1)

    store.undo()

    expect(store.getSlides()).toHaveLength(0)
  })

  it('round-trips slides through a fresh store over the same doc', () => {
    const doc = new Y.Doc()
    const store = new SceneStore(doc)
    const id = store.addSlide(rect, 'Kept')

    const reopened = new SceneStore(doc)

    expect(reopened.getSlides()).toEqual([{ id, name: 'Kept', rect, order: 0 }])
  })
})
