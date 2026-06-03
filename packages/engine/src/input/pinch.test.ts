import { describe, expect, it } from 'vitest'
import { pinchDelta, pinchSample } from './pinch.js'

describe('pinchSample', () => {
  it('computes midpoint and distance between two points', () => {
    const sample = pinchSample({ x: 0, y: 0 }, { x: 4, y: 3 })
    expect(sample.center).toEqual({ x: 2, y: 1.5 })
    expect(sample.distance).toBe(5)
  })
})

describe('pinchDelta', () => {
  it('reports pan from the moving center', () => {
    const previous = pinchSample({ x: 0, y: 0 }, { x: 10, y: 0 })
    const next = pinchSample({ x: 5, y: 4 }, { x: 15, y: 4 })
    const delta = pinchDelta(previous, next)
    expect(delta.panX).toBe(5)
    expect(delta.panY).toBe(4)
  })

  it('reports scale from changing distance', () => {
    const previous = pinchSample({ x: 0, y: 0 }, { x: 10, y: 0 })
    const next = pinchSample({ x: 0, y: 0 }, { x: 20, y: 0 })
    expect(pinchDelta(previous, next).scale).toBe(2)
  })

  it('keeps scale stable when fingers start coincident', () => {
    const previous = pinchSample({ x: 5, y: 5 }, { x: 5, y: 5 })
    const next = pinchSample({ x: 0, y: 0 }, { x: 10, y: 0 })
    expect(pinchDelta(previous, next).scale).toBe(1)
  })
})
