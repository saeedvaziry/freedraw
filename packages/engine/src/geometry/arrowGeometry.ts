import type { Point } from '../model/types.js'

export const ROUTE_AXIS_TOLERANCE = 0.5

export type RouteSegmentAxis = 'horizontal' | 'vertical'

export interface EditableRouteSegment {
  index: number
  axis: RouteSegmentAxis
  midpoint: Point
}

export function routeSegmentAxis(a: Point, b: Point): RouteSegmentAxis | null {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  if (dy <= ROUTE_AXIS_TOLERANCE && dx > ROUTE_AXIS_TOLERANCE) return 'horizontal'
  if (dx <= ROUTE_AXIS_TOLERANCE && dy > ROUTE_AXIS_TOLERANCE) return 'vertical'
  return null
}

export function editableRouteSegments(points: Point[]): EditableRouteSegment[] {
  const segments: EditableRouteSegment[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    const axis = routeSegmentAxis(start, end)
    if (!axis) continue
    segments.push({
      index,
      axis,
      midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    })
  }
  return segments
}

export function moveRouteSegment(points: Point[], segmentIndex: number, target: Point): Point[] {
  const start = points[segmentIndex]
  const end = points[segmentIndex + 1]
  if (!start || !end) return clonePoints(points)
  const axis = routeSegmentAxis(start, end)
  if (!axis) return clonePoints(points)
  if (axis === 'horizontal') return moveHorizontalSegment(points, segmentIndex, target.y)
  return moveVerticalSegment(points, segmentIndex, target.x)
}

export function simplifyRoute(points: Point[]): Point[] {
  const deduped: Point[] = []
  for (const point of points) {
    const last = deduped[deduped.length - 1]
    if (last && Math.abs(last.x - point.x) < ROUTE_AXIS_TOLERANCE && Math.abs(last.y - point.y) < ROUTE_AXIS_TOLERANCE) {
      continue
    }
    deduped.push(point)
  }
  const result: Point[] = []
  for (let i = 0; i < deduped.length; i += 1) {
    const prev = result[result.length - 1]
    const curr = deduped[i]!
    const next = deduped[i + 1]
    if (prev && next && isCollinear(prev, curr, next)) continue
    result.push(curr)
  }
  return result.length >= 2 ? result : deduped
}

function moveHorizontalSegment(points: Point[], segmentIndex: number, y: number): Point[] {
  const start = points[segmentIndex]!
  const end = points[segmentIndex + 1]!
  if (points.length === 2) {
    return simplifyRoute([start, { x: start.x, y }, { x: end.x, y }, end])
  }
  const next = clonePoints(points)
  if (segmentIndex === 0) {
    next[1] = { ...next[1]!, y }
    next.splice(1, 0, { x: next[0]!.x, y })
    return simplifyRoute(next)
  }
  if (segmentIndex === next.length - 2) {
    next[segmentIndex] = { ...next[segmentIndex]!, y }
    next.splice(segmentIndex + 1, 0, { x: next[segmentIndex + 1]!.x, y })
    return simplifyRoute(next)
  }
  next[segmentIndex] = { ...next[segmentIndex]!, y }
  next[segmentIndex + 1] = { ...next[segmentIndex + 1]!, y }
  return simplifyRoute(next)
}

function moveVerticalSegment(points: Point[], segmentIndex: number, x: number): Point[] {
  const start = points[segmentIndex]!
  const end = points[segmentIndex + 1]!
  if (points.length === 2) {
    return simplifyRoute([start, { x, y: start.y }, { x, y: end.y }, end])
  }
  const next = clonePoints(points)
  if (segmentIndex === 0) {
    next[1] = { ...next[1]!, x }
    next.splice(1, 0, { x, y: next[0]!.y })
    return simplifyRoute(next)
  }
  if (segmentIndex === next.length - 2) {
    next[segmentIndex] = { ...next[segmentIndex]!, x }
    next.splice(segmentIndex + 1, 0, { x, y: next[segmentIndex + 1]!.y })
    return simplifyRoute(next)
  }
  next[segmentIndex] = { ...next[segmentIndex]!, x }
  next[segmentIndex + 1] = { ...next[segmentIndex + 1]!, x }
  return simplifyRoute(next)
}

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ ...point }))
}

function isCollinear(a: Point, b: Point, c: Point): boolean {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return Math.abs(cross) < ROUTE_AXIS_TOLERANCE
}
