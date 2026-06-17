import { describe, expect, it } from 'vitest'
import type { ArrowElement } from '../model/types.js'
import { SceneStore } from '../store/SceneStore.js'
import { importDiagram } from './import.js'

describe('importDiagram', () => {
  it('adds shapes and a routed arrow to the store', () => {
    const store = new SceneStore()
    const errors = importDiagram(store, 'flowchart TD\nA[a] --> B[b]', { x: 0, y: 0 })
    expect(errors).toHaveLength(0)

    const snapshot = store.getSnapshot()
    const elements = Object.values(snapshot.elements)
    const arrow = elements.find((element) => element.type === 'arrow') as ArrowElement
    expect(elements.filter((element) => element.type === 'rect')).toHaveLength(2)
    expect(arrow.route.length).toBeGreaterThanOrEqual(2)
    expect(arrow.start?.elementId).toBeDefined()
    expect(arrow.end?.elementId).toBeDefined()
  })

  it('selects the imported elements', () => {
    const store = new SceneStore()
    importDiagram(store, 'A --> B', { x: 0, y: 0 })
    expect(store.getUiState().selectedIds.size).toBe(3)
  })

  it('leaves the scene unchanged on a parse error', () => {
    const store = new SceneStore()
    const errors = importDiagram(store, 'A -->', { x: 0, y: 0 })
    expect(errors.length).toBeGreaterThan(0)
    expect(store.getSnapshot().order).toHaveLength(0)
  })
})
