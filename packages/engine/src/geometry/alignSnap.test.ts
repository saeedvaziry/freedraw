import { describe, expect, it } from 'vitest'
import { alignGuides, snapMove, snapResizeBounds } from './alignSnap.js'
import type { Rect } from './rect.js'

const rect = (x: number, y: number, width = 100, height = 60): Rect => ({ x, y, width, height })

describe('snapMove', () => {
  it('snaps a left edge to a neighbour right edge within threshold', () => {
    const moving = rect(103, 300)
    const other = rect(0, 300)
    const result = snapMove(moving, [other], 6)
    expect(result.dx).toBe(-3)
    expect(result.lines.find((l) => l.axis === 'x')).toMatchObject({ axis: 'x', position: 100 })
  })

  it('spans the alignment line across both shapes', () => {
    const other = rect(100, 0)
    const result = snapMove(rect(103, 200), [other], 6)
    expect(result.dx).toBe(-3)
    const xLine = result.lines.find((l) => l.axis === 'x')
    expect(xLine).toMatchObject({ axis: 'x', position: 100 })
    expect(xLine!.start).toBe(0)
    expect(xLine!.end).toBe(260)
  })

  it('prefers center alignment when it is closer', () => {
    const other = rect(0, 300)
    const moving = rect(2, 300)
    const result = snapMove(moving, [other], 6)
    expect(result.dx).toBe(-2)
    expect(result.lines[0]).toMatchObject({ axis: 'x', position: 0 })
  })

  it('does not snap beyond threshold', () => {
    const result = snapMove(rect(220, 220), [rect(0, 0)], 6)
    expect(result.dx).toBe(0)
    expect(result.dy).toBe(0)
    expect(result.lines).toHaveLength(0)
  })

  it('snaps to equal spacing between two neighbours', () => {
    const a = rect(0, 0)
    const b = rect(150, 0)
    const moving = rect(298, 0)
    const result = snapMove(moving, [a, b], 6)
    expect(result.dx).toBe(2)
    expect(result.distances.some((d) => d.axis === 'x')).toBe(true)
  })
})

describe('snapResizeBounds', () => {
  it('snaps the moving edge while the fixed edge stays', () => {
    const grid = rect(0, 0, 197, 60)
    const result = snapResizeBounds(grid, { left: false, right: true, top: false, bottom: false }, [rect(200, 0)], 6)
    expect(result.bounds.x).toBe(0)
    expect(result.bounds.width).toBe(200)
    expect(result.lines.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps the opposite edge fixed when dragging the left edge', () => {
    const grid = rect(98, 0, 102, 60)
    const result = snapResizeBounds(grid, { left: true, right: false, top: false, bottom: false }, [rect(0, 0)], 6)
    expect(result.bounds.x).toBe(100)
    expect(result.bounds.x + result.bounds.width).toBe(200)
  })
})

describe('alignGuides', () => {
  it('maps an x line to vertical world points', () => {
    const guides = alignGuides([{ axis: 'x', position: 50, start: 10, end: 90 }])
    expect(guides[0]).toEqual({ kind: 'align', from: { x: 50, y: 10 }, to: { x: 50, y: 90 } })
  })

  it('maps a distance indicator with an absolute label', () => {
    const guides = alignGuides([], [{ axis: 'x', from: 20, to: 80, position: 40 }])
    expect(guides[0]).toEqual({ kind: 'distance', from: { x: 20, y: 40 }, to: { x: 80, y: 40 }, label: 60 })
  })
})
