import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../model/schema.js'
import type { Element } from '../model/types.js'
import { resizeElements } from './transform.js'

function labeledRect(): Element {
  return {
    id: 'r1',
    type: 'rect',
    x: 0,
    y: 0,
    width: 300,
    height: 80,
    rotation: 0,
    style: { ...defaultStyle },
    label: { text: 'hi', align: 'center', verticalAlign: 'middle', baseWidth: 120, baseHeight: 80 },
  }
}

describe('resizeElements label floor', () => {
  it('adopts the resized size as the new label floor', () => {
    const element = labeledRect()
    const frame = { bounds: { x: 0, y: 0, width: 300, height: 80 }, rotation: 0, center: { x: 150, y: 40 } }
    const result = resizeElements([element], frame, { x: 0, y: 0, width: 600, height: 160 })[0]!
    expect(result.patch.width).toBe(600)
    expect(result.patch.label?.baseWidth).toBe(600)
    expect(result.patch.label?.baseHeight).toBe(160)
  })

  it('leaves elements without a stored floor untouched', () => {
    const element = labeledRect()
    element.label = { text: 'hi', align: 'center', verticalAlign: 'middle' }
    const frame = { bounds: { x: 0, y: 0, width: 300, height: 80 }, rotation: 0, center: { x: 150, y: 40 } }
    const result = resizeElements([element], frame, { x: 0, y: 0, width: 600, height: 160 })[0]!
    expect(result.patch.label).toBeUndefined()
  })
})
