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

function distanceCount(guides: ReturnType<typeof alignMovingBounds>['guides']): number {
  return guides.filter((g) => g.kind === 'distance').length
}

describe('alignMovingBounds', () => {
  it('returns no offset on an empty scene', () => {
    const result = alignMovingBounds({ x: 12, y: 12, width: 100, height: 100 }, snapshotOf([]), new Set())
    expect(result.offset).toEqual({ x: 0, y: 0 })
    expect(result.guides).toEqual([])
  })

  it('snaps a left edge to another shape left edge within threshold', () => {
    const other = createShape({ id: 'o', x: 0, y: 300, width: 80, height: 80, style: { fill: '#fff' } })
    const result = alignMovingBounds({ x: 4, y: 0, width: 100, height: 100 }, snapshotOf([other]), new Set())
    expect(result.offset.x).toBe(-4)
  })

  it('snaps centers together', () => {
    const other = createShape({ id: 'o', x: 50, y: 300, width: 100, height: 100, style: { fill: '#fff' } })
    const result = alignMovingBounds({ x: 53, y: 0, width: 100, height: 100 }, snapshotOf([other]), new Set())
    expect(result.offset.x).toBe(-3)
  })

  it('does not snap beyond the threshold', () => {
    const other = createShape({ id: 'o', x: 0, y: 300, width: 80, height: 80, style: { fill: '#fff' } })
    const result = alignMovingBounds({ x: 40, y: 0, width: 100, height: 100 }, snapshotOf([other]), new Set())
    expect(result.offset.x).toBe(0)
  })

  it('emits an extended alignment line spanning aligned shapes', () => {
    const other = createShape({ id: 'o', x: 0, y: 300, width: 100, height: 100, style: { fill: '#fff' } })
    const result = alignMovingBounds({ x: 2, y: 0, width: 100, height: 100 }, snapshotOf([other]), new Set())
    const line = result.guides.find((g) => g.kind === 'line')
    expect(line).toBeDefined()
    if (line?.kind === 'line') {
      expect(line.from.x).toBe(0)
      expect(line.from.y).toBeLessThan(0)
      expect(line.to.y).toBeGreaterThan(400)
    }
  })

  it('collapses ties at one position into a single snap line', () => {
    const a = createShape({ id: 'a', x: 0, y: 200, width: 60, height: 60, style: { fill: '#fff' } })
    const b = createShape({ id: 'b', x: 0, y: 400, width: 60, height: 60, style: { fill: '#fff' } })
    const result = alignMovingBounds({ x: 100, y: 0, width: 60, height: 60 }, snapshotOf([a, b]), new Set())
    const lines = result.guides.filter((g) => g.kind === 'line')
    expect(result.offset.x).toBe(0)
    expect(lines).toHaveLength(0)
  })

  it('snaps to reproduce an existing gap rhythm', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const b = createShape({ id: 'b', x: 100, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const result = alignMovingBounds({ x: 203, y: 0, width: 50, height: 50 }, snapshotOf([a, b]), new Set())
    expect(result.offset.x).toBe(-3)
    expect(distanceCount(result.guides)).toBeGreaterThan(0)
  })

  it('shows distance indicators to nearest neighbors when aligned', () => {
    const top = createShape({ id: 't', x: 0, y: 0, width: 50, height: 50, style: { fill: '#fff' } })
    const bottom = createShape({ id: 'b', x: 0, y: 200, width: 50, height: 50, style: { fill: '#fff' } })
    const result = alignMovingBounds({ x: 3, y: 100, width: 50, height: 50 }, snapshotOf([top, bottom]), new Set())
    expect(result.offset.x).toBe(-3)
    expect(distanceCount(result.guides)).toBe(2)
  })

  it('ignores selected elements as alignment targets', () => {
    const other = createShape({ id: 'o', x: 4, y: 300, width: 80, height: 80, style: { fill: '#fff' } })
    const result = alignMovingBounds(
      { x: 0, y: 0, width: 100, height: 100 },
      snapshotOf([other]),
      new Set(['o']),
    )
    expect(result.offset).toEqual({ x: 0, y: 0 })
    expect(result.guides).toEqual([])
  })
})
