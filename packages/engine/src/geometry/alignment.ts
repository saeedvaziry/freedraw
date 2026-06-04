import type { SceneSnapshot } from '../model/types.js'
import type { Rect } from './rect.js'
import { intersects } from './rect.js'
import type { SnapGuide } from './snap.js'

export const ALIGNMENT_SNAP_DISTANCE = 5
const LINE_EXTENSION = 8

type Axis = 'x' | 'y'

interface Edges {
  left: number
  centerX: number
  right: number
  top: number
  centerY: number
  bottom: number
}

interface SnapCandidate {
  position: number
  edges: Edges
}

interface GapSegment {
  from: number
  to: number
  cross: number
}

interface EqualSpacing {
  delta: number
  axis: Axis
  matched: GapSegment
  reference: GapSegment
}

export interface AlignmentResult {
  offset: { x: number; y: number }
  guides: SnapGuide[]
}

function edgesOf(rect: Rect): Edges {
  return {
    left: rect.x,
    centerX: rect.x + rect.width / 2,
    right: rect.x + rect.width,
    top: rect.y,
    centerY: rect.y + rect.height / 2,
    bottom: rect.y + rect.height,
  }
}

function overlapsAcross(a: Rect, b: Rect, axis: Axis): boolean {
  if (axis === 'x') return a.y + a.height > b.y && a.y < b.y + b.height
  return a.x + a.width > b.x && a.x < b.x + b.width
}

function crossCenter(rect: Rect, axis: Axis): number {
  return axis === 'x' ? rect.y + rect.height / 2 : rect.x + rect.width / 2
}

function findEqualSpacing(moving: Rect, rects: Rect[], axis: Axis, threshold: number): EqualSpacing | null {
  let best: EqualSpacing | null = null
  const span = axis === 'x' ? moving.width : moving.height
  const movingCross = crossCenter(moving, axis)
  const lead = axis === 'x' ? moving.x : moving.y

  const consider = (
    delta: number,
    matched: GapSegment,
    refA: Rect,
    refB: Rect,
  ): void => {
    if (Math.abs(delta) >= threshold) return
    if (best && Math.abs(delta) >= Math.abs(best.delta)) return
    const reference: GapSegment = {
      from: trailingEdge(refA, axis),
      to: leadingEdge(refB, axis),
      cross: (crossCenter(refA, axis) + crossCenter(refB, axis)) / 2,
    }
    best = { delta, axis, matched, reference }
  }

  for (const refA of rects) {
    for (const refB of rects) {
      if (refA === refB) continue
      if (!overlapsAcross(refA, refB, axis)) continue
      const refGap = leadingEdge(refB, axis) - trailingEdge(refA, axis)
      if (refGap <= 0) continue

      for (const anchor of rects) {
        if (!overlapsAcross(anchor, moving, axis)) continue

        const after = trailingEdge(anchor, axis) + refGap
        consider(after - lead, { from: trailingEdge(anchor, axis), to: after, cross: movingCross }, refA, refB)

        const before = leadingEdge(anchor, axis) - refGap - span
        consider(before - lead, { from: before + span, to: leadingEdge(anchor, axis), cross: movingCross }, refA, refB)
      }
    }
  }
  return best
}

function leadingEdge(rect: Rect, axis: Axis): number {
  return axis === 'x' ? rect.x : rect.y
}

function trailingEdge(rect: Rect, axis: Axis): number {
  return axis === 'x' ? rect.x + rect.width : rect.y + rect.height
}

function nearestNeighborGuides(moving: Rect, rects: Rect[], axis: Axis): SnapGuide[] {
  const guides: SnapGuide[] = []
  const before = nearestBefore(moving, rects, axis)
  if (before) {
    const gap = leadingEdge(moving, axis) - trailingEdge(before, axis)
    if (gap > 0) guides.push(distanceGuide(trailingEdge(before, axis), leadingEdge(moving, axis), moving, before, axis))
  }
  const after = nearestAfter(moving, rects, axis)
  if (after) {
    const gap = leadingEdge(after, axis) - trailingEdge(moving, axis)
    if (gap > 0) guides.push(distanceGuide(trailingEdge(moving, axis), leadingEdge(after, axis), moving, after, axis))
  }
  return guides
}

function nearestBefore(moving: Rect, rects: Rect[], axis: Axis): Rect | null {
  let best: Rect | null = null
  for (const rect of rects) {
    if (!overlapsAcross(rect, moving, axis)) continue
    if (trailingEdge(rect, axis) > leadingEdge(moving, axis)) continue
    if (!best || trailingEdge(rect, axis) > trailingEdge(best, axis)) best = rect
  }
  return best
}

function nearestAfter(moving: Rect, rects: Rect[], axis: Axis): Rect | null {
  let best: Rect | null = null
  for (const rect of rects) {
    if (!overlapsAcross(rect, moving, axis)) continue
    if (leadingEdge(rect, axis) < trailingEdge(moving, axis)) continue
    if (!best || leadingEdge(rect, axis) < leadingEdge(best, axis)) best = rect
  }
  return best
}

function distanceGuide(from: number, to: number, moving: Rect, other: Rect, axis: Axis): SnapGuide {
  if (axis === 'x') {
    const top = Math.max(moving.y, other.y)
    const bottom = Math.min(moving.y + moving.height, other.y + other.height)
    const cross = (top + bottom) / 2
    return { kind: 'distance', from: { x: from, y: cross }, to: { x: to, y: cross } }
  }
  const left = Math.max(moving.x, other.x)
  const right = Math.min(moving.x + moving.width, other.x + other.width)
  const cross = (left + right) / 2
  return { kind: 'distance', from: { x: cross, y: from }, to: { x: cross, y: to } }
}

function gapGuide(segment: GapSegment, axis: Axis): SnapGuide {
  if (axis === 'x') {
    return { kind: 'distance', from: { x: segment.from, y: segment.cross }, to: { x: segment.to, y: segment.cross } }
  }
  return { kind: 'distance', from: { x: segment.cross, y: segment.from }, to: { x: segment.cross, y: segment.to } }
}

function equalSpacingGuides(spacing: EqualSpacing): SnapGuide[] {
  return [gapGuide(spacing.matched, spacing.axis), gapGuide(spacing.reference, spacing.axis)]
}

function snapLineGuide(candidates: SnapCandidate[], moving: Edges, axis: Axis): SnapGuide[] {
  const byPosition = new Map<number, { start: number; end: number }>()
  for (const candidate of candidates) {
    const extent = lineExtent(moving, candidate.edges, axis)
    const existing = byPosition.get(candidate.position)
    if (existing) {
      existing.start = Math.min(existing.start, extent.start)
      existing.end = Math.max(existing.end, extent.end)
    } else {
      byPosition.set(candidate.position, extent)
    }
  }
  const guides: SnapGuide[] = []
  for (const [position, { start, end }] of byPosition) {
    if (axis === 'x') {
      guides.push({ kind: 'line', from: { x: position, y: start - LINE_EXTENSION }, to: { x: position, y: end + LINE_EXTENSION } })
    } else {
      guides.push({ kind: 'line', from: { x: start - LINE_EXTENSION, y: position }, to: { x: end + LINE_EXTENSION, y: position } })
    }
  }
  return guides
}

function lineExtent(moving: Edges, other: Edges, axis: Axis): { start: number; end: number } {
  if (axis === 'x') {
    const all = [moving.top, moving.bottom, other.top, other.bottom]
    return { start: Math.min(...all), end: Math.max(...all) }
  }
  const all = [moving.left, moving.right, other.left, other.right]
  return { start: Math.min(...all), end: Math.max(...all) }
}

function staticRects(snapshot: SceneSnapshot, ignore: Set<string>, viewport: Rect | null): Rect[] {
  const rects: Rect[] = []
  for (const id of snapshot.order) {
    if (ignore.has(id)) continue
    const element = snapshot.elements[id]
    if (!element || element.type === 'arrow' || element.type === 'line') continue
    const rect = { x: element.x, y: element.y, width: element.width, height: element.height }
    if (viewport && !intersects(rect, viewport)) continue
    rects.push(rect)
  }
  return rects
}

export function alignMovingBounds(
  bounds: Rect,
  snapshot: SceneSnapshot,
  ignore: Set<string>,
  options: { threshold?: number; viewport?: Rect | null } = {},
): AlignmentResult {
  const threshold = options.threshold ?? ALIGNMENT_SNAP_DISTANCE
  const rects = staticRects(snapshot, ignore, options.viewport ?? null)
  if (rects.length === 0) return { offset: { x: 0, y: 0 }, guides: [] }

  const moving = edgesOf(bounds)
  let bestDx = threshold
  let bestDy = threshold
  let offsetX = 0
  let offsetY = 0
  let xCandidates: SnapCandidate[] = []
  let yCandidates: SnapCandidate[] = []

  for (const rect of rects) {
    const edges = edgesOf(rect)
    for (const my of [moving.left, moving.centerX, moving.right]) {
      for (const target of [edges.left, edges.centerX, edges.right]) {
        const distance = Math.abs(my - target)
        if (distance > bestDx) continue
        if (distance < bestDx) {
          bestDx = distance
          offsetX = target - my
          xCandidates = [{ position: target, edges }]
        } else {
          xCandidates.push({ position: target, edges })
        }
      }
    }
    for (const my of [moving.top, moving.centerY, moving.bottom]) {
      for (const target of [edges.top, edges.centerY, edges.bottom]) {
        const distance = Math.abs(my - target)
        if (distance > bestDy) continue
        if (distance < bestDy) {
          bestDy = distance
          offsetY = target - my
          yCandidates = [{ position: target, edges }]
        } else {
          yCandidates.push({ position: target, edges })
        }
      }
    }
  }

  const equalX = findEqualSpacing(bounds, rects, 'x', threshold)
  if (equalX && Math.abs(equalX.delta) < bestDx) {
    bestDx = Math.abs(equalX.delta)
    offsetX = equalX.delta
    xCandidates = []
  }
  const equalY = findEqualSpacing(bounds, rects, 'y', threshold)
  if (equalY && Math.abs(equalY.delta) < bestDy) {
    bestDy = Math.abs(equalY.delta)
    offsetY = equalY.delta
    yCandidates = []
  }

  const snapped: Rect = { ...bounds, x: bounds.x + offsetX, y: bounds.y + offsetY }
  const snappedEdges = edgesOf(snapped)
  const snappedOnX = bestDx < threshold
  const snappedOnY = bestDy < threshold

  const equalSnappedX = xCandidates.length === 0 && Boolean(equalX) && snappedOnX
  const equalSnappedY = yCandidates.length === 0 && Boolean(equalY) && snappedOnY

  const guides: SnapGuide[] = []
  guides.push(...snapLineGuide(xCandidates, snappedEdges, 'x'))
  guides.push(...snapLineGuide(yCandidates, snappedEdges, 'y'))
  if (equalSnappedX && equalX) guides.push(...equalSpacingGuides(equalX))
  else if (snappedOnY) guides.push(...nearestNeighborGuides(snapped, rects, 'x'))
  if (equalSnappedY && equalY) guides.push(...equalSpacingGuides(equalY))
  else if (snappedOnX) guides.push(...nearestNeighborGuides(snapped, rects, 'y'))

  return { offset: { x: offsetX, y: offsetY }, guides }
}
