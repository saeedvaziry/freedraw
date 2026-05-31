import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { hitTest, hitTestElement, marqueeHits, selectionBounds } from './hitTest.js'

function snapshotOf(elements: Element[]): SceneSnapshot {
  const map: Record<string, Element> = {}
  elements.forEach((element) => {
    map[element.id] = element
  })
  return {
    elements: map,
    order: elements.map((element) => element.id),
    appState: { schemaVersion: 1, camera: { x: 0, y: 0, zoom: 1 }, lastUsedStyle: {} as never },
  }
}

describe('hitTestElement', () => {
  it('hits inside a filled rect and misses outside', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 100, height: 60, style: { fill: '#fff' } })
    expect(hitTestElement({ x: 50, y: 30 }, rect)).toBe(true)
    expect(hitTestElement({ x: 200, y: 30 }, rect)).toBe(false)
  })

  it('hits inside a filled ellipse and misses the corner', () => {
    const ellipse = createShape({
      id: 'e',
      type: 'ellipse',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      style: { fill: '#fff' },
    })
    expect(hitTestElement({ x: 50, y: 50 }, ellipse)).toBe(true)
    expect(hitTestElement({ x: 5, y: 5 }, ellipse)).toBe(false)
  })

  it('hits the stroke band of an unfilled diamond, misses the empty interior corner', () => {
    const diamond = createShape({ id: 'd', type: 'diamond', x: 0, y: 0, width: 100, height: 100 })
    expect(hitTestElement({ x: 50, y: 50 }, diamond)).toBe(true)
    expect(hitTestElement({ x: 2, y: 2 }, diamond)).toBe(false)
  })

  it('hits near an edge within tolerance for an unfilled rect', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 100, height: 60 })
    expect(hitTestElement({ x: -3, y: 30 }, rect)).toBe(true)
    expect(hitTestElement({ x: -30, y: 30 }, rect)).toBe(false)
  })

  it('respects rotation when hit-testing', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 100, height: 20, style: { fill: '#fff' } })
    rect.rotation = Math.PI / 2
    expect(hitTestElement({ x: 50, y: 50 }, rect)).toBe(true)
    expect(hitTestElement({ x: 95, y: 10 }, rect)).toBe(false)
  })
})

describe('hitTest', () => {
  it('returns the front-most element under the point', () => {
    const back = createShape({ id: 'back', x: 0, y: 0, width: 100, height: 100, style: { fill: '#fff' } })
    const front = createShape({ id: 'front', x: 50, y: 50, width: 100, height: 100, style: { fill: '#fff' } })
    const hit = hitTest({ x: 75, y: 75 }, snapshotOf([back, front]))
    expect(hit?.id).toBe('front')
  })

  it('returns null on empty canvas', () => {
    const rect = createShape({ id: 'r', x: 0, y: 0, width: 10, height: 10, style: { fill: '#fff' } })
    expect(hitTest({ x: 500, y: 500 }, snapshotOf([rect]))).toBeNull()
  })
})

describe('selectionBounds', () => {
  it('computes the union AABB of multiple elements', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 50, height: 50 })
    const b = createShape({ id: 'b', x: 100, y: 80, width: 40, height: 20 })
    expect(selectionBounds([a, b])).toEqual({ x: 0, y: 0, width: 140, height: 100 })
  })

  it('returns null with no elements', () => {
    expect(selectionBounds([])).toBeNull()
  })
})

describe('marqueeHits', () => {
  it('selects elements intersecting the marquee', () => {
    const inside = createShape({ id: 'in', x: 10, y: 10, width: 20, height: 20 })
    const outside = createShape({ id: 'out', x: 500, y: 500, width: 20, height: 20 })
    const hits = marqueeHits({ x: 0, y: 0, width: 100, height: 100 }, snapshotOf([inside, outside]))
    expect(hits.map((element) => element.id)).toEqual(['in'])
  })

  it('selects on partial overlap', () => {
    const partial = createShape({ id: 'p', x: 90, y: 90, width: 40, height: 40 })
    const hits = marqueeHits({ x: 0, y: 0, width: 100, height: 100 }, snapshotOf([partial]))
    expect(hits).toHaveLength(1)
  })
})
