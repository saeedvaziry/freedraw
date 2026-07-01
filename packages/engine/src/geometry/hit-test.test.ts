import { describe, expect, it } from 'vitest'
import { defaultAppState, defaultStyle } from '../model/schema.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { nearestShape } from './hit-test.js'

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
