import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { alignMovingBounds } from './alignment.js'

function snapshotOf(elements: Element[]): SceneSnapshot {
  const map: Record<string, Element> = {}
  elements.forEach((element) => {
    map[element.id] = element
  })
  return {
    elements: map,
    order: elements.map((e) => e.id),
    appState: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, lastUsedStyle: {} as never },
  }
}

const moving = { id: 'm', x: 0, y: 0, width: 100, height: 100, style: { fill: '#fff' } }

describe('alignMovingBounds', () => {
  it('returns no offset on an empty scene', () => {
    const result = alignMovingBounds(
      { x: 12, y: 12, width: 100, height: 100 },
      snapshotOf([]),
      new Set(['m']),
    )
    expect(result.offset).toEqual({ x: 0, y: 0 })
    expect(result.guides).toEqual([])
  })

  it('snaps a left edge to another shape left edge within threshold', () => {
    const other = createShape({ id: 'o', x: 0, y: 300, width: 80, height: 80, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 4, y: 0, width: 100, height: 100 },
      snapshotOf([createShape(moving), other]),
      new Set(['m']),
    )
    expect(result.offset.x).toBe(-4)
  })

  it('snaps centers together', () => {
    const other = createShape({ id: 'o', x: 50, y: 300, width: 100, height: 100, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 5, y: 0, width: 100, height: 100 },
      snapshotOf([createShape(moving), other]),
      new Set(['m']),
    )
    expect(result.offset.x).toBe(-5)
  })

  it('does not snap beyond the threshold', () => {
    const other = createShape({ id: 'o', x: 0, y: 300, width: 80, height: 80, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 40, y: 0, width: 100, height: 100 },
      snapshotOf([createShape(moving), other]),
      new Set(['m']),
    )
    expect(result.offset.x).toBe(0)
  })

  it('emits an alignment line spanning aligned shapes', () => {
    const other = createShape({ id: 'o', x: 0, y: 300, width: 100, height: 100, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 2, y: 0, width: 100, height: 100 },
      snapshotOf([createShape(moving), other]),
      new Set(['m']),
    )
    const line = result.guides.find((g) => g.kind === 'line')
    expect(line).toBeDefined()
    if (line?.kind === 'line') {
      expect(line.from.x).toBe(0)
      expect(line.from.y).toBe(0)
      expect(line.to.y).toBe(400)
    }
  })

  it('emits equal-spacing distance guides between three shapes', () => {
    const left = createShape({ id: 'l', x: 0, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const right = createShape({ id: 'r', x: 200, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 100, y: 0, width: 50, height: 50 },
      snapshotOf([left, right]),
      new Set(['m']),
    )
    const distances = result.guides.filter((g) => g.kind === 'distance')
    expect(distances).toHaveLength(2)
  })

  it('does not emit spacing guides when gaps are unequal', () => {
    const left = createShape({ id: 'l', x: 0, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const right = createShape({ id: 'r', x: 300, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 100, y: 0, width: 50, height: 50 },
      snapshotOf([left, right]),
      new Set(['m']),
    )
    const distances = result.guides.filter((g) => g.kind === 'distance')
    expect(distances).toHaveLength(0)
  })

  it('ignores selected elements as alignment targets', () => {
    const other = createShape({ id: 'o', x: 4, y: 300, width: 80, height: 80, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 0, y: 0, width: 100, height: 100 },
      snapshotOf([createShape(moving), other]),
      new Set(['m', 'o']),
    )
    expect(result.offset).toEqual({ x: 0, y: 0 })
  })
})
