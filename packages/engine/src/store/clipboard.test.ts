import { describe, expect, it } from 'vitest'
import { createBinding } from '../connectors/binding.js'
import { createArrow, createImage, createShape, createSticky, createText } from '../model/factory.js'
import type { ArrowElement } from '../model/types.js'
import { SceneStore } from './SceneStore.js'
import { parseSceneClipboard, stringifySceneClipboard } from './clipboard.js'

function seedBound(store: SceneStore): void {
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
}

function arrow(store: SceneStore, id: string): ArrowElement {
  return store.getSnapshot().elements[id] as ArrowElement
}

describe('scene clipboard', () => {
  it('copies and pastes supported board element data', () => {
    const store = new SceneStore()
    const shape = {
      ...createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 80 }),
      label: { text: 'Decision', align: 'center' as const, verticalAlign: 'middle' as const },
    }
    const text = createText({ id: 'text', x: 140, y: 0, text: 'Notes' })
    const sticky = {
      ...createSticky({ id: 'sticky', x: 280, y: 0 }),
      label: { text: 'Next', align: 'left' as const, verticalAlign: 'top' as const },
    }
    const image = createImage({
      id: 'image',
      assetId: 'asset-1',
      x: 460,
      y: 0,
      naturalWidth: 120,
      naturalHeight: 80,
      viewportWidth: 1000,
      viewportHeight: 800,
    })
    store.transact((api) => {
      api.addElement(shape)
      api.addElement(text)
      api.addElement(sticky)
      api.addElement(image)
    })

    const payload = store.copyElements(['shape', 'text', 'sticky', 'image'])
    expect(payload?.elements.map((element) => element.id)).toEqual([
      'shape',
      'text',
      'sticky',
      'image',
    ])

    const pastedIds = store.pasteElements()
    const snapshot = store.getSnapshot()
    const pastedShape = snapshot.elements[pastedIds[0]!]!
    const pastedText = snapshot.elements[pastedIds[1]!]!
    const pastedSticky = snapshot.elements[pastedIds[2]!]!
    const pastedImage = snapshot.elements[pastedIds[3]!]!

    expect(pastedIds).toHaveLength(4)
    expect(pastedShape).toMatchObject({ type: 'rect', x: 16, y: 16, label: shape.label })
    expect(pastedText).toMatchObject({ type: 'text', text: 'Notes', x: 156, y: 16 })
    expect(pastedSticky).toMatchObject({ type: 'sticky', label: sticky.label, x: 296, y: 16 })
    expect(pastedImage).toMatchObject({ type: 'image', assetId: 'asset-1', x: 476, y: 16 })
    expect(store.getUiState().selectedIds).toEqual(new Set(pastedIds))
  })

  it('serializes and parses clipboard payloads', () => {
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 80 })),
    )
    const payload = store.copyElements(['shape'])!
    expect(parseSceneClipboard(stringifySceneClipboard(payload))).toEqual(payload)
    expect(parseSceneClipboard('{')).toBeNull()
    expect(parseSceneClipboard('{"version":1,"id":"x","elements":[]}')).toBeNull()
  })

  it('copies selected shapes with their internal connector', () => {
    const store = new SceneStore()
    seedBound(store)

    const payload = store.copyElements(['a', 'b'])
    expect(payload?.elements.map((element) => element.id)).toEqual(['a', 'b', 'arr'])

    const pastedIds = store.pasteElements()
    const [aClone, bClone, arrowClone] = pastedIds
    const clone = arrow(store, arrowClone!)

    expect(clone.start?.elementId).toBe(aClone)
    expect(clone.end?.elementId).toBe(bClone)
    expect([...store.arrowsForShape(aClone!)]).toEqual([arrowClone])
    expect([...store.arrowsForShape(bClone!)]).toEqual([arrowClone])
    expect([...store.arrowsForShape('a')]).toEqual(['arr'])
    expect([...store.arrowsForShape('b')]).toEqual(['arr'])
  })

  it('detaches connector bindings that point outside the copied content', () => {
    const store = new SceneStore()
    seedBound(store)

    const pastedIds = store.pasteElements({ payload: store.copyElements(['arr']) })
    const clone = arrow(store, pastedIds[0]!)

    expect(clone.start).toBeUndefined()
    expect(clone.end).toBeUndefined()
    expect(clone.points).toEqual([
      { x: 116, y: 66 },
      { x: 316, y: 66 },
    ])
  })

  it('offsets repeated pastes from the original copied content', () => {
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 80 })),
    )
    store.copyElements(['shape'])

    const firstId = store.pasteElements()[0]!
    const secondId = store.pasteElements()[0]!

    expect(store.getSnapshot().elements[firstId]).toMatchObject({ x: 16, y: 16 })
    expect(store.getSnapshot().elements[secondId]).toMatchObject({ x: 32, y: 32 })
  })

  it('centers pasted content on a target point', () => {
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 80 })),
    )
    store.copyElements(['shape'])

    const pastedId = store.pasteElements({ target: { x: 500, y: 500 } })[0]!

    expect(store.getSnapshot().elements[pastedId]).toMatchObject({ x: 450, y: 460 })
  })

  it('centers pasted connected groups on a target point', () => {
    const store = new SceneStore()
    seedBound(store)
    store.copyElements(['a', 'b'])

    const pastedIds = store.pasteElements({ target: { x: 1000, y: 1000 } })
    const [aClone, bClone, arrowClone] = pastedIds
    const pastedArrow = arrow(store, arrowClone!)

    expect(store.getSnapshot().elements[aClone!]).toMatchObject({ x: 800, y: 950 })
    expect(store.getSnapshot().elements[bClone!]).toMatchObject({ x: 1100, y: 950 })
    expect(pastedArrow.start?.elementId).toBe(aClone)
    expect(pastedArrow.end?.elementId).toBe(bClone)
  })

  it('does not drift repeated cursor-targeted pastes', () => {
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 80 })),
    )
    store.copyElements(['shape'])

    const firstId = store.pasteElements({ target: { x: 500, y: 500 } })[0]!
    const secondId = store.pasteElements({ target: { x: 500, y: 500 } })[0]!

    expect(store.getSnapshot().elements[firstId]).toMatchObject({ x: 450, y: 460 })
    expect(store.getSnapshot().elements[secondId]).toMatchObject({ x: 450, y: 460 })
  })

  it('translates detached arrows to the target point', () => {
    const store = new SceneStore()
    seedBound(store)
    const payload = store.copyElements(['arr'])

    const pastedId = store.pasteElements({ payload, target: { x: 500, y: 500 } })[0]!
    const clone = arrow(store, pastedId)

    expect(clone.start).toBeUndefined()
    expect(clone.end).toBeUndefined()
    expect(clone.points).toEqual([
      { x: 400, y: 500 },
      { x: 600, y: 500 },
    ])
  })

  it('undoes pasted content in one step', () => {
    const store = new SceneStore()
    seedBound(store)

    store.copyElements(['a', 'b'])
    store.pasteElements()
    expect(store.getSnapshot().order).toHaveLength(6)

    store.undo()
    expect(store.getSnapshot().order).toHaveLength(3)
    expect(store.getSnapshot().order).toEqual(['a', 'b', 'arr'])
  })

  it('cuts selected shapes with their internal connector in one undo step', () => {
    const store = new SceneStore()
    seedBound(store)

    const payload = store.cutElements(['a', 'b'])

    expect(payload?.elements.map((element) => element.id)).toEqual(['a', 'b', 'arr'])
    expect(store.getSnapshot().order).toEqual([])
    expect(store.getUiState().clipboardElementCount).toBe(3)

    store.undo()

    expect(store.getSnapshot().order).toEqual(['a', 'b', 'arr'])
  })

  it('cuts cascade-deleted connectors into the clipboard', () => {
    const store = new SceneStore()
    seedBound(store)

    const payload = store.cutElements(['a'])
    expect(payload?.elements.map((element) => element.id)).toEqual(['a', 'arr'])
    expect(store.getSnapshot().order).toEqual(['b'])

    const pastedIds = store.pasteElements({ target: { x: 500, y: 500 } })
    const [aClone, arrowClone] = pastedIds
    const pastedArrow = arrow(store, arrowClone!)

    expect(store.getSnapshot().elements[aClone!]).toMatchObject({ x: 350.5, y: 450 })
    expect(pastedArrow.start?.elementId).toBe(aClone)
    expect(pastedArrow.end).toBeUndefined()
  })

  it('duplicates selected shapes with their internal connector', () => {
    const store = new SceneStore()
    seedBound(store)

    const duplicateIds = store.duplicateElements(['a', 'b'])
    const [aClone, bClone, arrowClone] = duplicateIds
    const clone = arrow(store, arrowClone!)

    expect(duplicateIds).toHaveLength(3)
    expect(store.getSnapshot().elements[aClone!]).toMatchObject({ x: 16, y: 16 })
    expect(store.getSnapshot().elements[bClone!]).toMatchObject({ x: 316, y: 16 })
    expect(clone.points).toEqual([
      { x: 116, y: 66 },
      { x: 316, y: 66 },
    ])
    expect(clone.start?.elementId).toBe(aClone)
    expect(clone.end?.elementId).toBe(bClone)
  })
})
