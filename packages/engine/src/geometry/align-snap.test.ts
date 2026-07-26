import { describe, expect, it } from 'vitest'
import {
  alignGuides,
  arrayCandidateSource,
  localAlignRects,
  snapMove,
  snapResizeBounds,
  type AlignCandidate,
  type AlignSpace,
} from './align-snap.js'
import type { Rect } from './rect.js'
import { rotatePoint } from './rotate.js'

const r = (x: number, y: number, width = 20, height = 20): Rect => ({ x, y, width, height })

const spaceAt = (rotation: number): AlignSpace => ({ center: { x: 0, y: 0 }, rotation })

function candidateFromLocal(local: Rect, space: AlignSpace): AlignCandidate {
  const center = rotatePoint(
    { x: local.x + local.width / 2, y: local.y + local.height / 2 },
    space.center,
    space.rotation,
  )
  return {
    x: center.x - local.width / 2,
    y: center.y - local.height / 2,
    width: local.width,
    height: local.height,
    rotation: space.rotation,
  }
}

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

describe('localAlignRects', () => {
  it('leaves candidates untouched in an unrotated space', () => {
    const candidates: AlignCandidate[] = [
      { ...r(0, 0), rotation: 0 },
      { ...r(50, 10), rotation: 1.2 },
    ]

    expect(localAlignRects(candidates, spaceAt(0))).toEqual([r(0, 0), r(50, 10)])
  })

  it('maps a candidate that shares the space rotation onto a tight local rect', () => {
    const space = spaceAt(Math.PI / 4)
    const local = localAlignRects([candidateFromLocal(r(40, 60), space)], space)[0]!

    expect(local.x).toBeCloseTo(40, 6)
    expect(local.y).toBeCloseTo(60, 6)
    expect(local.width).toBeCloseTo(20, 6)
    expect(local.height).toBeCloseTo(20, 6)
  })

  it('bounds a candidate whose rotation differs from the space', () => {
    const space = spaceAt(Math.PI / 4)
    const local = localAlignRects([{ ...r(100, 0), rotation: 0 }], space)[0]!

    expect(local.width).toBeCloseTo(20 * Math.SQRT2, 6)
    expect(local.height).toBeCloseTo(20 * Math.SQRT2, 6)
  })
})

describe('snapMove in a rotated space', () => {
  it('snaps flush to a neighbour that shares the rotation and draws the constraint it applied', () => {
    const space = spaceAt(0.7)
    const moving = r(3, 0)
    const candidates = localAlignRects([candidateFromLocal(r(0, 40), space)], space)

    const res = snapMove(moving, candidates, 5)
    expect(res.dx).toBeCloseTo(-3, 6)
    expect(moving.x + res.dx).toBeCloseTo(candidates[0]!.x, 6)

    const guide = alignGuides(res.lines, res.distances, space).find(
      (candidate): candidate is Extract<typeof candidate, { kind: 'align' }> => candidate.kind === 'align',
    )
    expect(guide).toBeDefined()
    for (const point of [guide!.from, guide!.to]) {
      expect(rotatePoint(point, space.center, -space.rotation).x).toBeCloseTo(0, 6)
    }
  })

  it('snaps to the local bound of a neighbour whose rotation differs and keeps the guide on that bound', () => {
    const space = spaceAt(Math.PI / 4)
    const candidate: AlignCandidate = { ...r(100, 100), rotation: 0 }
    const local = localAlignRects([candidate], space)[0]!
    const moving = { ...r(0, 0), x: local.x + 1, y: local.y + 200 }

    const res = snapMove(moving, [local], 5)
    expect(moving.x + res.dx).toBeCloseTo(local.x, 6)

    const corners = [
      { x: candidate.x, y: candidate.y },
      { x: candidate.x + candidate.width, y: candidate.y },
      { x: candidate.x + candidate.width, y: candidate.y + candidate.height },
      { x: candidate.x, y: candidate.y + candidate.height },
    ].map((corner) => rotatePoint(corner, space.center, -space.rotation))
    expect(Math.min(...corners.map((corner) => corner.x))).toBeCloseTo(local.x, 6)

    const guide = alignGuides(res.lines, res.distances, space).find(
      (candidateGuide): candidateGuide is Extract<typeof candidateGuide, { kind: 'align' }> =>
        candidateGuide.kind === 'align',
    )
    expect(guide).toBeDefined()
    expect(rotatePoint(guide!.from, space.center, -space.rotation).x).toBeCloseTo(local.x, 6)
  })

  it('keeps guides in world space when the space is unrotated', () => {
    const res = snapMove(r(3, 300), [r(0, 0)], 5)

    expect(alignGuides(res.lines, res.distances, spaceAt(0))).toEqual(alignGuides(res.lines, res.distances))
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
