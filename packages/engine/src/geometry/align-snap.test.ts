import { describe, expect, it } from 'vitest'
import { arrayCandidateSource, snapMove, snapResizeBounds } from './align-snap.js'
import type { Rect } from './rect.js'

const r = (x: number, y: number, width = 20, height = 20): Rect => ({ x, y, width, height })

describe('snapMove edge alignment', () => {
  it('does not snap when nothing is near', () => {
    const res = snapMove(r(500, 500), [r(0, 0), r(50, 0)], 5)
    expect(res.dx).toBe(0)
    expect(res.dy).toBe(0)
    expect(res.lines).toEqual([])
    expect(res.distances).toEqual([])
  })

  it('snaps left edges together on X', () => {
    const res = snapMove(r(3, 300), [r(0, 0)], 5)
    expect(res.dx).toBe(-3)
    expect(res.dy).toBe(0)
    expect(res.lines).toContainEqual(expect.objectContaining({ axis: 'x', position: 0 }))
  })

  it('snaps top edges together on Y', () => {
    const res = snapMove(r(300, 2), [r(0, 0)], 5)
    expect(res.dx).toBe(0)
    expect(res.dy).toBe(-2)
    expect(res.lines).toContainEqual(expect.objectContaining({ axis: 'y', position: 0 }))
  })

  it('snaps centers together on both axes', () => {
    const res = snapMove(r(2, 3), [r(0, 0)], 5)
    expect(res.dx).toBe(-2)
    expect(res.dy).toBe(-3)
  })
})

describe('snapMove equal spacing', () => {
  it('snaps to equal horizontal spacing using a reference gap', () => {
    const others = [r(0, 0), r(50, 0), r(100, 0)]
    const res = snapMove(r(148, 0), others, 5)
    expect(res.dx).toBe(2)
    expect(res.dy).toBe(0)
    expect(res.distances.some((d) => d.axis === 'x')).toBe(true)
  })

  it('snaps to equal vertical spacing using a reference gap', () => {
    const others = [r(0, 0), r(0, 50), r(0, 100)]
    const res = snapMove(r(0, 148), others, 5)
    expect(res.dx).toBe(0)
    expect(res.dy).toBe(2)
    expect(res.distances.some((d) => d.axis === 'y')).toBe(true)
  })

  it('does not use a reference gap that is out of threshold', () => {
    const others = [r(0, 0), r(50, 0), r(100, 0)]
    const res = snapMove(r(160, 0), others, 5)
    expect(res.dx).toBe(0)
  })

  it('uses a reference gap from shapes outside the moving row band', () => {
    const others = [r(0, 0), r(50, 0), r(0, 200)]
    const res = snapMove(r(48, 200), others, 5)
    expect(res.dx).toBe(2)
    expect(res.dy).toBe(0)
  })
})

describe('candidate source seam', () => {
  it('produces identical results whether the source is implicit or explicit', () => {
    const others = [r(0, 0), r(50, 0), r(100, 0)]
    const moving = r(148, 0)
    const implicit = snapMove(moving, others, 5)
    const explicit = snapMove(moving, others, 5, arrayCandidateSource(others))
    expect(explicit).toEqual(implicit)
  })
})

describe('snapMove distance indicators', () => {
  it('reports the nearest gap once aligned on an axis', () => {
    const others = [r(0, 0), r(200, 0)]
    const res = snapMove(r(2, 0), others, 5)
    expect(res.dx).toBe(-2)
    expect(res.distances.length).toBeGreaterThan(0)
  })
})

describe('snapResizeBounds', () => {
  it('snaps the right edge to a neighbour', () => {
    const res = snapResizeBounds(
      { x: 0, y: 0, width: 48, height: 20 },
      { left: false, right: true, top: false, bottom: false },
      [r(50, 0)],
      5,
    )
    expect(res.bounds.width).toBe(50)
    expect(res.bounds.x).toBe(0)
    expect(res.lines.some((l) => l.axis === 'x')).toBe(true)
  })

  it('leaves bounds untouched when no edge is near', () => {
    const res = snapResizeBounds(
      { x: 0, y: 0, width: 20, height: 20 },
      { left: false, right: true, top: false, bottom: false },
      [r(500, 0)],
      5,
    )
    expect(res.bounds).toEqual({ x: 0, y: 0, width: 20, height: 20 })
    expect(res.lines).toEqual([])
  })
})
