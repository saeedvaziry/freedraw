import { describe, expect, it } from 'vitest'
import { SceneStore } from '../store/SceneStore.js'
import { createShape, createText } from './factory.js'
import type { ShapeElement, TextElement } from './types.js'

describe('createText', () => {
  it('creates a center-aligned empty text element with defaults', () => {
    const text = createText({ x: 10, y: 20 })
    expect(text.type).toBe('text')
    expect(text.text).toBe('')
    expect(text.style.textAlign).toBe('center')
    expect(text.width).toBeGreaterThan(0)
    expect(text.height).toBeGreaterThan(0)
  })
})

describe('label commit updates the model', () => {
  it('writes a label onto a shape and clears it', () => {
    const store = new SceneStore()
    const shape = createShape({ x: 0, y: 0, width: 100, height: 60 })
    store.transact((api) => api.addElement(shape))

    store.transact((api) =>
      api.updateElement(shape.id, {
        label: { text: 'Hello', align: 'center', verticalAlign: 'middle' },
      }),
    )
    const withLabel = store.getSnapshot().elements[shape.id] as ShapeElement
    expect(withLabel.label?.text).toBe('Hello')

    store.transact((api) => api.updateElement(shape.id, { label: undefined }))
    const cleared = store.getSnapshot().elements[shape.id] as ShapeElement
    expect(cleared.label).toBeUndefined()
  })

  it('updates a text element body', () => {
    const store = new SceneStore()
    const text = createText({ x: 0, y: 0 })
    store.transact((api) => api.addElement(text))
    store.transact((api) => api.updateElement(text.id, { text: 'Typed' }))
    const updated = store.getSnapshot().elements[text.id] as TextElement
    expect(updated.text).toBe('Typed')
  })
})
