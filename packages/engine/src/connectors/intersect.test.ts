import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import { intersectRay } from './intersect.js'

const center = { x: 50, y: 50 }

describe('intersectRay', () => {
  it('lands on the right edge of a rect when heading right', () => {
    const rect = createShape({ x: 0, y: 0, width: 100, height: 100 })
    const hit = intersectRay(rect, center, { x: 200, y: 50 })
    expect(hit.x).toBeCloseTo(100)
    expect(hit.y).toBeCloseTo(50)
  })

  it('lands on the top edge of a rect when heading up', () => {
    const rect = createShape({ x: 0, y: 0, width: 100, height: 100 })
    const hit = intersectRay(rect, center, { x: 50, y: -200 })
    expect(hit.x).toBeCloseTo(50)
    expect(hit.y).toBeCloseTo(0)
  })

  it('lands on the left edge when heading left', () => {
    const rect = createShape({ x: 0, y: 0, width: 100, height: 100 })
    const hit = intersectRay(rect, center, { x: -50, y: 50 })
    expect(hit.x).toBeCloseTo(0)
    expect(hit.y).toBeCloseTo(50)
  })

  it('stays pinned to a right-edge anchor even when the other end moves down', () => {
    const rect = createShape({ x: 0, y: 0, width: 100, height: 100 })
    const anchor = { x: 100, y: 50 }
    const hit = intersectRay(rect, anchor, { x: 300, y: 250 })
    expect(hit.x).toBeCloseTo(100)
    expect(hit.y).toBeCloseTo(50)
  })

  it('lands on an ellipse boundary when heading right', () => {
    const ellipse = createShape({ type: 'ellipse', x: 0, y: 0, width: 100, height: 60 })
    const hit = intersectRay(ellipse, { x: 50, y: 30 }, { x: 500, y: 30 })
    expect(hit.x).toBeCloseTo(100)
    expect(hit.y).toBeCloseTo(30)
  })

  it('lands on a diamond edge when heading right', () => {
    const diamond = createShape({ type: 'diamond', x: 0, y: 0, width: 100, height: 100 })
    const hit = intersectRay(diamond, center, { x: 200, y: 50 })
    expect(hit.x).toBeCloseTo(100)
    expect(hit.y).toBeCloseTo(50)
  })

  it('respects rotation', () => {
    const rect = createShape({ x: 0, y: 0, width: 100, height: 100 })
    rect.rotation = Math.PI / 2
    const hit = intersectRay(rect, center, { x: 50, y: 300 })
    expect(hit.x).toBeCloseTo(50)
    expect(hit.y).toBeCloseTo(100)
  })
})
