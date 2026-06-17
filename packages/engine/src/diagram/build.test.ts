import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../model/schema.js'
import type { ArrowElement, ShapeElement } from '../model/types.js'
import { buildElements } from './build.js'
import { layoutDiagram } from './layout.js'
import { parse } from './parse.js'

function build(text: string) {
  const { ast } = parse(text)
  return buildElements(ast, layoutDiagram(ast), defaultStyle)
}

describe('buildElements', () => {
  it('creates a labeled shape for a node', () => {
    const { elements } = build('A[Start]')
    const shape = elements[0] as ShapeElement
    expect(shape.type).toBe('rect')
    expect(shape.label).toMatchObject({ text: 'Start' })
  })

  it('maps each shape token to a shape type', () => {
    const { elements } = build('A((c))\nB{d}\nC[(db)]')
    expect(elements.map((element) => element.type)).toEqual(['ellipse', 'diamond', 'cylinder'])
  })

  it('binds an arrow to its source and target shapes', () => {
    const { elements } = build('A --> B')
    const arrow = elements.find((element) => element.type === 'arrow') as ArrowElement
    const [a, b] = elements.filter((element) => element.type !== 'arrow')
    expect(arrow.start?.elementId).toBe(a!.id)
    expect(arrow.end?.elementId).toBe(b!.id)
    expect(arrow.routing).toBe('orthogonal')
  })

  it('applies the edge label and arrowheads', () => {
    const { elements } = build('A -->|yes| B')
    const arrow = elements.find((element) => element.type === 'arrow') as ArrowElement
    expect(arrow.label).toMatchObject({ text: 'yes' })
    expect(arrow.endArrowhead).toBe('triangle')
  })

  it('orders nodes before arrows', () => {
    const { elements } = build('A --> B')
    expect(elements.map((element) => element.type)).toEqual(['rect', 'rect', 'arrow'])
  })

  it('anchors the arrow to the facing edges', () => {
    const { elements } = build('flowchart LR\nA --> B')
    const arrow = elements.find((element) => element.type === 'arrow') as ArrowElement
    expect(arrow.start?.anchor).toMatchObject({ nx: 1, ny: 0.5 })
    expect(arrow.end?.anchor).toMatchObject({ nx: 0, ny: 0.5 })
  })
})
