import { describe, expect, it } from 'vitest'
import { createArrow } from '../model/factory.js'
import { defaultAppState, defaultStyle } from '../model/schema.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { expandGroupSelection, groupMembers, hitTest, marqueeHits, nearestShape } from './hit-test.js'

function snapshotOf(...elements: Element[]): SceneSnapshot {
  return {
    elements: Object.fromEntries(elements.map((element) => [element.id, element])),
    order: elements.map((element) => element.id),
    appState: defaultAppState(),
  }
}

const rect: Element = {
  id: 'r1',
  type: 'rect',
  x: 0,
  y: 0,
  width: 120,
  height: 80,
  rotation: 0,
  style: { ...defaultStyle },
}

describe('nearestShape', () => {
  const snapshot = snapshotOf(rect)

  it('matches inside the shape', () => {
    expect(nearestShape({ x: 60, y: 40 }, snapshot, 32)?.id).toBe('r1')
  })

  it('matches within the margin band just outside the edge', () => {
    expect(nearestShape({ x: 140, y: 40 }, snapshot, 32)?.id).toBe('r1')
  })

  it('ignores points beyond the margin', () => {
    expect(nearestShape({ x: 200, y: 40 }, snapshot, 32)).toBeNull()
  })

  it('ignores arrows', () => {
    const arrow: Element = {
      id: 'a1',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 100,
      height: 0,
      rotation: 0,
      style: { ...defaultStyle },
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      route: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      startArrowhead: 'none',
      endArrowhead: 'triangle',
      routing: 'straight',
    }
    expect(nearestShape({ x: 50, y: 0 }, snapshotOf(arrow), 32)).toBeNull()
  })
})

describe('locked elements', () => {
  it('are skipped by hitTest', () => {
    const locked: Element = { ...rect, id: 'locked', locked: true }
    expect(hitTest({ x: 60, y: 40 }, snapshotOf(locked))).toBeNull()
  })

  it('are skipped by marqueeHits', () => {
    const locked: Element = { ...rect, id: 'locked', locked: true }
    const open: Element = { ...rect, id: 'open', x: 200 }
    const hits = marqueeHits({ x: -10, y: -10, width: 400, height: 200 }, snapshotOf(locked, open))
    expect(hits.map((element) => element.id)).toEqual(['open'])
  })
})

describe('group selection', () => {
  const a: Element = { ...rect, id: 'a', groupId: 'g1' }
  const b: Element = { ...rect, id: 'b', x: 200, groupId: 'g1' }
  const c: Element = { ...rect, id: 'c', x: 400 }
  const snapshot = snapshotOf(a, b, c)

  it('lists every member of a group in scene order', () => {
    expect(groupMembers(snapshot, 'g1')).toEqual(['a', 'b'])
  })

  it('expands a single group member to the whole group', () => {
    expect([...expandGroupSelection(['a'], snapshot)].sort()).toEqual(['a', 'b'])
  })

  it('leaves ungrouped elements untouched', () => {
    expect([...expandGroupSelection(['c'], snapshot)]).toEqual(['c'])
  })
})

describe('hitTest', () => {
  it('matches the visible label area of an arrow', () => {
    const arrow: Element = {
      ...createArrow({
        id: 'a1',
        points: [
          { x: 0, y: 160 },
          { x: 240, y: 160 },
        ],
      }),
      label: {
        text: 'relationship label',
        align: 'center',
        verticalAlign: 'middle',
      },
    }

    expect(hitTest({ x: 120, y: 140 }, snapshotOf(arrow))?.id).toBe('a1')
  })
})
