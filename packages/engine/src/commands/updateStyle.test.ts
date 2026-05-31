import { describe, expect, it } from 'vitest'
import { SceneStore } from '../store/SceneStore.js'
import { MIXED } from '../store/selectionStyle.js'
import { createShape } from '../model/factory.js'
import { dashPattern } from '../render/painters/dash.js'

function seed(store: SceneStore, count: number): string[] {
  const ids: string[] = []
  store.transact((api) => {
    for (let index = 0; index < count; index += 1) {
      const shape = createShape({ x: index * 100, y: 0, width: 80, height: 60 })
      api.addElement(shape)
      ids.push(shape.id)
    }
  })
  store.stopCapturing()
  return ids
}

describe('updateStyle', () => {
  it('patches the style of the targeted elements only', () => {
    const store = new SceneStore()
    const [a, b, c] = seed(store, 3)

    store.updateStyle([a!, b!], { stroke: '#ff0000', strokeWidth: 6 })

    const elements = store.getSnapshot().elements
    expect(elements[a!]!.style.stroke).toBe('#ff0000')
    expect(elements[a!]!.style.strokeWidth).toBe(6)
    expect(elements[b!]!.style.stroke).toBe('#ff0000')
    expect(elements[c!]!.style.stroke).toBe('#1e1e1e')
  })

  it('applies a multi-select edit in one undo step', () => {
    const store = new SceneStore()
    const [a, b] = seed(store, 2)

    store.updateStyle([a!, b!], { fill: '#00ff00' })
    expect(store.getSnapshot().elements[a!]!.style.fill).toBe('#00ff00')
    expect(store.getSnapshot().elements[b!]!.style.fill).toBe('#00ff00')

    store.undo()
    expect(store.getSnapshot().elements[a!]!.style.fill).toBe('transparent')
    expect(store.getSnapshot().elements[b!]!.style.fill).toBe('transparent')
  })

  it('updates lastUsedStyle so new elements inherit it', () => {
    const store = new SceneStore()
    const [a] = seed(store, 1)

    store.updateStyle([a!], { stroke: '#123456', strokeStyle: 'dashed' })

    const next = store.getLastUsedStyle()
    expect(next.stroke).toBe('#123456')
    expect(next.strokeStyle).toBe('dashed')

    const created = createShape({ x: 0, y: 0, width: 10, height: 10, style: store.getLastUsedStyle() })
    expect(created.style.stroke).toBe('#123456')
    expect(created.style.strokeStyle).toBe('dashed')
  })

  it('does not record lastUsedStyle changes as a separate undo step', () => {
    const store = new SceneStore()
    const [a] = seed(store, 1)

    store.updateStyle([a!], { stroke: '#abcdef' })
    store.undo()

    expect(store.getSnapshot().elements[a!]!.style.stroke).toBe('#1e1e1e')
  })
})

describe('selectionStyle slice', () => {
  it('returns shared values when the selection agrees', () => {
    const store = new SceneStore()
    const [a, b] = seed(store, 2)
    store.updateStyle([a!, b!], { stroke: '#ff0000' })
    store.setUiState({ selectedIds: new Set([a!, b!]) })

    expect(store.getSelectionStyle().stroke).toBe('#ff0000')
  })

  it('flags mixed values when the selection disagrees', () => {
    const store = new SceneStore()
    const [a, b] = seed(store, 2)
    store.updateStyle([a!], { stroke: '#ff0000' })
    store.setUiState({ selectedIds: new Set([a!, b!]) })

    expect(store.getSelectionStyle().stroke).toBe(MIXED)
  })

  it('falls back to lastUsedStyle when nothing is selected', () => {
    const store = new SceneStore()
    store.updateLastUsedStyle({ fill: '#eeeeee' })

    expect(store.getSelectionStyle().fill).toBe('#eeeeee')
  })

  it('returns a stable reference until the derived values change', () => {
    const store = new SceneStore()
    const [a] = seed(store, 1)
    store.setUiState({ selectedIds: new Set([a!]) })

    const first = store.getSelectionStyle()
    expect(store.getSelectionStyle()).toBe(first)
  })
})

describe('strokeStyle line-dash mapping', () => {
  it('maps strokeStyle values used by the painters', () => {
    expect(dashPattern('solid')).toEqual([])
    expect(dashPattern('dashed')).toEqual([10, 6])
    expect(dashPattern('dotted')).toEqual([2, 6])
  })
})
