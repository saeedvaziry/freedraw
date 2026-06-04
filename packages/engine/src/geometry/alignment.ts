import type { SceneSnapshot } from '../model/types.js'
import type { Rect } from './rect.js'
import { intersects } from './rect.js'
import type { SnapGuide } from './snap.js'

export const ALIGNMENT_SNAP_DISTANCE = 6
export const SPACING_MATCH_TOLERANCE = 1

type Axis = 'x' | 'y'

export interface AlignmentResult {
  offset: { x: number; y: number }
  guides: SnapGuide[]
}

interface Candidate {
  delta: number
  value: number
}

function rectEdges(rect: Rect, axis: Axis): number[] {
  if (axis === 'x') return [rect.x, rect.x + rect.width / 2, rect.x + rect.width]
  return [rect.y, rect.y + rect.height / 2, rect.y + rect.height]
}

function snapAxis(moving: Rect, rects: Rect[], axis: Axis, threshold: number): Candidate | null {
  let best: Candidate | null = null
  for (const source of rectEdges(moving, axis)) {
    for (const rect of rects) {
      for (const target of rectEdges(rect, axis)) {
        const delta = target - source
        const distance = Math.abs(delta)
        if (distance > threshold) continue
        if (best && distance >= Math.abs(best.delta)) continue
        best = { delta, value: target }
      }
    }
  }
  return best
}

function onAxis(rect: Rect, value: number, axis: Axis): boolean {
  return rectEdges(rect, axis).some((edge) => Math.abs(edge - value) < SPACING_MATCH_TOLERANCE)
}

function alignmentLine(value: number, axis: Axis, rects: Rect[], moving: Rect): SnapGuide {
  const spans = [moving, ...rects.filter((rect) => onAxis(rect, value, axis))]
  if (axis === 'x') {
    const top = Math.min(...spans.map((r) => r.y))
    const bottom = Math.max(...spans.map((r) => r.y + r.height))
    return { kind: 'line', from: { x: value, y: top }, to: { x: value, y: bottom } }
  }
  const left = Math.min(...spans.map((r) => r.x))
  const right = Math.max(...spans.map((r) => r.x + r.width))
  return { kind: 'line', from: { x: left, y: value }, to: { x: right, y: value } }
}

function overlapsAcross(a: Rect, b: Rect, axis: Axis): boolean {
  if (axis === 'x') return a.y < b.y + b.height && b.y < a.y + a.height
  return a.x < b.x + b.width && b.x < a.x + a.width
}

function gapBefore(moving: Rect, other: Rect, axis: Axis): number {
  if (axis === 'x') return moving.x - (other.x + other.width)
  return moving.y - (other.y + other.height)
}

function gapAfter(moving: Rect, other: Rect, axis: Axis): number {
  if (axis === 'x') return other.x - (moving.x + moving.width)
  return other.y - (moving.y + moving.height)
}

function closestNeighbor(
  rects: Rect[],
  gapOf: (rect: Rect) => number,
): { rect: Rect; gap: number } | null {
  let best: { rect: Rect; gap: number } | null = null
  for (const rect of rects) {
    const gap = gapOf(rect)
    if (gap <= 0) continue
    if (best && gap >= best.gap) continue
    best = { rect, gap }
  }
  return best
}

function distanceGuide(first: Rect, second: Rect, axis: Axis): SnapGuide {
  if (axis === 'x') {
    const top = Math.max(first.y, second.y)
    const bottom = Math.min(first.y + first.height, second.y + second.height)
    const mid = (top + bottom) / 2
    return { kind: 'distance', from: { x: first.x + first.width, y: mid }, to: { x: second.x, y: mid } }
  }
  const left = Math.max(first.x, second.x)
  const right = Math.min(first.x + first.width, second.x + second.width)
  const mid = (left + right) / 2
  return { kind: 'distance', from: { x: mid, y: first.y + first.height }, to: { x: mid, y: second.y } }
}

function spacingGuidesForAxis(moving: Rect, rects: Rect[], axis: Axis): SnapGuide[] {
  const neighbors = rects.filter((rect) => overlapsAcross(moving, rect, axis))
  const before = closestNeighbor(neighbors, (rect) => gapBefore(moving, rect, axis))
  const after = closestNeighbor(neighbors, (rect) => gapAfter(moving, rect, axis))
  if (!before || !after) return []
  if (Math.abs(before.gap - after.gap) > SPACING_MATCH_TOLERANCE) return []
  return [distanceGuide(before.rect, moving, axis), distanceGuide(moving, after.rect, axis)]
}

function spacingGuides(moving: Rect, rects: Rect[]): SnapGuide[] {
  return [...spacingGuidesForAxis(moving, rects, 'x'), ...spacingGuidesForAxis(moving, rects, 'y')]
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

  const x = snapAxis(bounds, rects, 'x', threshold)
  const y = snapAxis(bounds, rects, 'y', threshold)
  const offset = { x: x?.delta ?? 0, y: y?.delta ?? 0 }
  const snapped: Rect = { ...bounds, x: bounds.x + offset.x, y: bounds.y + offset.y }

  const guides: SnapGuide[] = []
  if (x) guides.push(alignmentLine(x.value, 'x', rects, snapped))
  if (y) guides.push(alignmentLine(y.value, 'y', rects, snapped))
  guides.push(...spacingGuides(snapped, rects))

  return { offset, guides }
}
