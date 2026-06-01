import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import { GRID_SIZE } from './grid.js'
import { selectionFrameFor } from './selectionFrame.js'
import { resizeElements, resizedBounds, rotationFor } from './transform.js'

describe('resizedBounds', () => {
  it('drags the SE handle keeping the NW corner fixed', () => {
    const frame = selectionFrameFor([createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })])!
    const next = resizedBounds(frame, 'se', { x: 200, y: 150 })
    expect(next).toEqual({ x: 0, y: 0, width: 200, height: 150 })
  })

  it('drags the NW handle keeping the SE corner fixed', () => {
    const frame = selectionFrameFor([createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })])!
    const next = resizedBounds(frame, 'nw', { x: -50, y: -50 })
    expect(next).toEqual({ x: -50, y: -50, width: 150, height: 150 })
  })

  it('clamps to a minimum dimension', () => {
    const frame = selectionFrameFor([createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })])!
    const next = resizedBounds(frame, 'se', { x: 0, y: 0 })
    expect(next.width).toBeGreaterThanOrEqual(GRID_SIZE)
    expect(next.height).toBeGreaterThanOrEqual(GRID_SIZE)
  })

  it('uses one grid cell as the minimum dimension', () => {
    const frame = selectionFrameFor([createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })])!
    const next = resizedBounds(frame, 'se', { x: 4, y: 4 })
    expect(next).toMatchObject({ width: GRID_SIZE, height: GRID_SIZE })
  })
})

describe('resizeElements', () => {
  it('scales each element proportionally within the frame', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 50, height: 50 })
    const b = createShape({ id: 'b', x: 50, y: 50, width: 50, height: 50 })
    const frame = selectionFrameFor([a, b])!
    const results = resizeElements([a, b], frame, { x: 0, y: 0, width: 200, height: 200 })
    expect(results[0]?.patch).toMatchObject({ x: 0, y: 0, width: 100, height: 100 })
    expect(results[1]?.patch).toMatchObject({ x: 100, y: 100, width: 100, height: 100 })
  })
})

describe('rotationFor', () => {
  it('returns zero when the pointer is directly above the center', () => {
    const frame = selectionFrameFor([createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })])!
    expect(rotationFor(frame, { x: 50, y: -100 })).toBeCloseTo(0)
  })

  it('returns a quarter turn when the pointer is to the right', () => {
    const frame = selectionFrameFor([createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })])!
    expect(rotationFor(frame, { x: 200, y: 50 })).toBeCloseTo(Math.PI / 2)
  })
})
