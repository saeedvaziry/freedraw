import { describe, expect, it } from 'vitest'
import type { Element, ElementId, SceneSnapshot } from '@freedraw/engine'
import {
  NUDGE_LARGE_STEP,
  NUDGE_STEP,
  describeElement,
  nudgeAnnouncement,
  nudgeVector,
  selectionAnnouncement,
  traverseKeyDirection,
} from './use-canvas-a11y.js'

function shape(id: string, over: Partial<Element> = {}): Element {
  return { id, type: 'rect', x: 0, y: 0, width: 10, height: 10, ...over } as Element
}

function scene(...elements: Element[]): SceneSnapshot {
  const snapshot = {
    elements: {} as Record<ElementId, Element>,
    order: [] as ElementId[],
    appState: {},
  }
  for (const element of elements) {
    snapshot.elements[element.id] = element
    snapshot.order.push(element.id)
  }

  return snapshot as unknown as SceneSnapshot
}

describe('nudgeVector', () => {
  it('maps every arrow key to a single point step', () => {
    expect(nudgeVector('ArrowLeft', false)).toEqual({
      dx: -NUDGE_STEP,
      dy: 0,
      direction: 'left',
      distance: NUDGE_STEP,
    })
    expect(nudgeVector('ArrowRight', false)?.dx).toBe(NUDGE_STEP)
    expect(nudgeVector('ArrowUp', false)?.dy).toBe(-NUDGE_STEP)
    expect(nudgeVector('ArrowDown', false)?.dy).toBe(NUDGE_STEP)
  })

  it('grows the step when the large modifier is set', () => {
    expect(nudgeVector('ArrowDown', true)).toEqual({
      dx: 0,
      dy: NUDGE_LARGE_STEP,
      direction: 'down',
      distance: NUDGE_LARGE_STEP,
    })
  })

  it('claims no other key', () => {
    expect(nudgeVector('a', false)).toBeNull()
    expect(nudgeVector('PageDown', false)).toBeNull()
  })
})

describe('traverseKeyDirection', () => {
  it('walks forwards on page down and backwards on page up', () => {
    expect(traverseKeyDirection('PageDown')).toBe('next')
    expect(traverseKeyDirection('PageUp')).toBe('previous')
  })

  it('leaves tab and every other key alone', () => {
    expect(traverseKeyDirection('Tab')).toBeNull()
    expect(traverseKeyDirection('ArrowDown')).toBeNull()
    expect(traverseKeyDirection('Home')).toBeNull()
  })
})

describe('describeElement', () => {
  it('names a shape by its toolbar label', () => {
    expect(describeElement(shape('a'))).toBe('Rectangle')
    expect(describeElement(shape('a', { type: 'roundRect' }))).toBe('Rounded rectangle')
  })

  it('names the element kinds that are not shapes', () => {
    expect(describeElement(shape('a', { type: 'sticky' }))).toBe('Sticky note')
    expect(describeElement(shape('a', { type: 'freedraw' }))).toBe('Freehand drawing')
    expect(describeElement(shape('a', { type: 'arrow' }))).toBe('Arrow')
    expect(describeElement(shape('a', { type: 'image' }))).toBe('Image')
  })

  it('quotes the label of an element that carries text', () => {
    expect(describeElement(shape('a', { label: { text: 'Sign up' } } as Partial<Element>))).toBe(
      'Rectangle "Sign up"',
    )
  })

  it('reads the body of a text element', () => {
    const element = { id: 'a', type: 'text', text: 'Hello\n  world', x: 0, y: 0, width: 1, height: 1 }

    expect(describeElement(element as unknown as Element)).toBe('Text "Hello world"')
  })

  it('truncates a very long label', () => {
    const element = shape('a', { label: { text: 'x'.repeat(80) } } as Partial<Element>)

    expect(describeElement(element)).toBe(`Rectangle "${'x'.repeat(40)}…"`)
  })

  it('calls out a locked element', () => {
    expect(describeElement(shape('a', { locked: true }))).toBe('Rectangle, locked')
  })
})

describe('selectionAnnouncement', () => {
  it('reports an empty selection', () => {
    expect(selectionAnnouncement(scene(shape('a')), new Set())).toBe('Nothing selected')
  })

  it('places a single selection in the z-order', () => {
    const snapshot = scene(shape('a'), shape('b', { type: 'ellipse' }), shape('c'))

    expect(selectionAnnouncement(snapshot, new Set(['b']))).toBe('Ellipse, 2 of 3 selected')
  })

  it('counts a multiple selection', () => {
    const snapshot = scene(shape('a'), shape('b'), shape('c'))

    expect(selectionAnnouncement(snapshot, new Set(['a', 'c']))).toBe('2 of 3 elements selected')
  })

  it('falls back to nothing selected when the selected id is gone', () => {
    expect(selectionAnnouncement(scene(shape('a')), new Set(['ghost']))).toBe('Nothing selected')
  })
})

describe('nudgeAnnouncement', () => {
  it('names a single moved element and the distance', () => {
    const snapshot = scene(shape('a'))
    const vector = nudgeVector('ArrowRight', false)!

    expect(nudgeAnnouncement(snapshot, ['a'], vector)).toBe('Moved Rectangle right by 1')
  })

  it('counts a multiple move', () => {
    const snapshot = scene(shape('a'), shape('b'))
    const vector = nudgeVector('ArrowUp', true)!

    expect(nudgeAnnouncement(snapshot, ['a', 'b'], vector)).toBe('Moved 2 elements up by 10')
  })
})
