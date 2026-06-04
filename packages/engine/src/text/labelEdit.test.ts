import { describe, expect, it } from 'vitest'
import { createArrow, createShape, createText } from '../model/factory.js'
import { labelEditRequest } from './labelEdit.js'

describe('labelEditRequest', () => {
  it('seeds a shape label edit with the typed text and disables select all', () => {
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 80 })
    const request = labelEditRequest(shape, 'a', { selectAll: false })

    expect(request.target).toBe('label')
    expect(request.text).toBe('a')
    expect(request.selectAll).toBe(false)
  })

  it('keeps existing label alignment when seeding', () => {
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 80 })
    shape.label = { text: 'old', align: 'left', verticalAlign: 'top' }
    const request = labelEditRequest(shape, 'x', { selectAll: false })

    expect(request.align).toBe('left')
    expect(request.verticalAlign).toBe('top')
    expect(request.text).toBe('x')
  })

  it('targets the text content for text elements', () => {
    const text = createText({ id: 'text', x: 10, y: 20, text: 'hi' })
    const request = labelEditRequest(text, 'z', { selectAll: false })

    expect(request.target).toBe('text')
    expect(request.text).toBe('z')
    expect(request.verticalAlign).toBe('top')
  })

  it('centers the edit on the arrow midpoint', () => {
    const arrow = createArrow({
      id: 'arrow',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    })
    const request = labelEditRequest(arrow, 'q', { selectAll: false })

    expect(request.target).toBe('label')
    expect(request.align).toBe('center')
    expect(request.text).toBe('q')
  })
})
