import { describe, expect, it } from 'vitest'
import { createArrow, createFreedraw, createShape } from '../model/factory.js'
import { defaultAppState } from '../model/schema.js'
import type { Binding, Element, SceneSnapshot } from '../model/types.js'
import { serializeDiagram } from './serialize.js'

function bindingTo(elementId: string, side: Binding['side']): Binding {
  return { elementId, anchor: { nx: 0.5, ny: 0.5 }, gap: 0, side }
}

function snapshotOf(elements: Element[]): SceneSnapshot {
  const map: Record<string, Element> = {}
  for (const element of elements) map[element.id] = element
  return { elements: map, order: elements.map((element) => element.id), appState: defaultAppState() }
}

function box(id: string, x: number, y: number, text: string): Element {
  const shape = createShape({ id, type: 'rect', x, y, width: 120, height: 80 })
  shape.label = { text, align: 'center', verticalAlign: 'middle' }
  return shape
}

function link(id: string, source: string, target: string): Element {
  return createArrow({
    id,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    start: bindingTo(source, 'right'),
    end: bindingTo(target, 'left'),
  })
}

describe('serializeDiagram', () => {
  it('reads the flow direction off the bound arrow geometry', () => {
    const rightward = serializeDiagram(
      snapshotOf([box('a', 0, 0, 'Start'), box('b', 600, 0, 'End'), link('ab', 'a', 'b')]),
    )
    const downward = serializeDiagram(
      snapshotOf([box('a', 0, 0, 'Start'), box('b', 0, 600, 'End'), link('ab', 'a', 'b')]),
    )

    expect(rightward.text.split('\n')[0]).toBe('flowchart LR')
    expect(downward.text.split('\n')[0]).toBe('flowchart TD')
  })

  it('declares nodes and edges from the scene', () => {
    const report = serializeDiagram(
      snapshotOf([box('a', 0, 0, 'Start'), box('b', 600, 0, 'End'), link('ab', 'a', 'b')]),
    )

    expect(report.text.split('\n').slice(1)).toEqual(['start[Start]', 'end[End]', 'start --> end'])
  })

  it('reports elements it cannot express', () => {
    const report = serializeDiagram(
      snapshotOf([
        box('a', 0, 0, 'Start'),
        createFreedraw({ id: 'scribble', points: [{ x: 0, y: 0 }, { x: 4, y: 4 }] }),
      ]),
    )

    expect(report.skipped).toEqual([{ id: 'scribble', type: 'freedraw' }])
  })

  it('picks the dotted thick operator from the arrow style', () => {
    const arrow = link('ab', 'a', 'b')
    arrow.style = { ...arrow.style, strokeStyle: 'dashed' }
    const report = serializeDiagram(snapshotOf([box('a', 0, 0, 'A'), box('b', 600, 0, 'B'), arrow]))

    expect(report.text).toContain('a -.-> b')
  })
})
