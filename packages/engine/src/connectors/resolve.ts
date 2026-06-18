import type { ArrowElement, Binding, Element, ElementId, Point } from '../model/types.js'
import { ROUTE_AXIS_TOLERANCE as AXIS_TOLERANCE, simplifyRoute } from '../geometry/arrow-geometry.js'
import { anchorNormal, anchorPoint, sideNormal } from './binding.js'

type Elements = Record<ElementId, Element>

const STUB = 20

function pullBack(point: Point, normal: Point, gap: number): Point {
  if (gap <= 0) return point
  return { x: point.x + normal.x * gap, y: point.y + normal.y * gap }
}

function boundTarget(binding: Binding, elements: Elements): Element | null {
  return elements[binding.elementId] ?? null
}

interface BoundEnd {
  port: Point
  normal: Point
}

function boundEnd(target: Element, binding: Binding): BoundEnd {
  const anchor = binding.anchor
  const rawNormal = binding.side ? sideNormal(target, binding.side) : anchorNormal(target, anchor)
  const gap = Math.max(binding.gap, target.style.strokeWidth / 2)
  return { port: pullBack(anchorPoint(target, anchor), rawNormal, gap), normal: axisNormal(rawNormal) }
}

function isHorizontal(normal: Point): boolean {
  return Math.abs(normal.x) >= Math.abs(normal.y)
}

function axisNormal(normal: Point): Point {
  if (isHorizontal(normal)) return { x: sign(normal.x) || 1, y: 0 }
  return { x: 0, y: sign(normal.y) || 1 }
}

function sign(value: number): number {
  if (Math.abs(value) < AXIS_TOLERANCE) return 0
  return Math.sign(value)
}

export function arrowRoute(arrow: ArrowElement): Point[] {
  return arrow.route.length >= 2 ? arrow.route : arrow.points
}

export function resolveArrowPoints(arrow: ArrowElement, elements: Elements): Point[] {
  const points = arrow.points.map((point) => ({ ...point }))
  if (points.length < 2) return points

  const startTarget = arrow.start ? boundTarget(arrow.start, elements) : null
  const endTarget = arrow.end ? boundTarget(arrow.end, elements) : null
  const start = startTarget && arrow.start ? boundEnd(startTarget, arrow.start) : null
  const end = endTarget && arrow.end ? boundEnd(endTarget, arrow.end) : null

  if (points.length > 2) return resolveWithWaypoints(points, start, end)

  const startPoint = start?.port ?? points[0]!
  const endPoint = end?.port ?? points[points.length - 1]!

  return orthogonalRoute(startPoint, start?.normal ?? null, endPoint, end?.normal ?? null)
}

function orthogonalRoute(
  startPoint: Point,
  startNormal: Point | null,
  endPoint: Point,
  endNormal: Point | null,
): Point[] {
  const straight = nearStraightRoute(startPoint, startNormal, endPoint, endNormal)
  if (straight) return straight

  const startStub = startNormal
    ? { x: startPoint.x + startNormal.x * STUB, y: startPoint.y + startNormal.y * STUB }
    : startPoint
  const endStub = endNormal
    ? { x: endPoint.x + endNormal.x * STUB, y: endPoint.y + endNormal.y * STUB }
    : endPoint

  const mids = route(startStub, startNormal, endStub, endNormal)
  return simplifyRoute([startPoint, startStub, ...mids, endStub, endPoint])
}

function nearStraightRoute(
  startPoint: Point,
  startNormal: Point | null,
  endPoint: Point,
  endNormal: Point | null,
): Point[] | null {
  const dx = endPoint.x - startPoint.x
  const dy = endPoint.y - startPoint.y
  if (
    Math.abs(dx) <= AXIS_TOLERANCE &&
    normalAllowsVertical(startNormal, sign(dy)) &&
    normalAllowsVertical(endNormal, sign(-dy))
  ) {
    return [startPoint, endPoint]
  }
  if (
    Math.abs(dy) <= AXIS_TOLERANCE &&
    normalAllowsHorizontal(startNormal, sign(dx)) &&
    normalAllowsHorizontal(endNormal, sign(-dx))
  ) {
    return [startPoint, endPoint]
  }
  return null
}

function normalAllowsVertical(normal: Point | null, direction: number): boolean {
  if (!normal) return true
  if (isHorizontal(normal)) return false
  return direction === 0 || sign(normal.y) === direction
}

function normalAllowsHorizontal(normal: Point | null, direction: number): boolean {
  if (!normal) return true
  if (!isHorizontal(normal)) return false
  return direction === 0 || sign(normal.x) === direction
}

function route(from: Point, fromNormal: Point | null, to: Point, toNormal: Point | null): Point[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) < AXIS_TOLERANCE || Math.abs(dy) < AXIS_TOLERANCE) return []

  const startH = fromNormal ? isHorizontal(fromNormal) : Math.abs(dx) >= Math.abs(dy)
  const endH = toNormal ? isHorizontal(toNormal) : !startH

  if (startH && endH) {
    const forwardOut = !fromNormal || Math.sign(fromNormal.x) === Math.sign(dx)
    const forwardIn = !toNormal || Math.sign(toNormal.x) === Math.sign(-dx)
    if (forwardOut && forwardIn) {
      const midX = (from.x + to.x) / 2
      return [{ x: midX, y: from.y }, { x: midX, y: to.y }]
    }
    const midY = (from.y + to.y) / 2
    return [{ x: from.x, y: midY }, { x: to.x, y: midY }]
  }

  if (!startH && !endH) {
    const forwardOut = !fromNormal || Math.sign(fromNormal.y) === Math.sign(dy)
    const forwardIn = !toNormal || Math.sign(toNormal.y) === Math.sign(-dy)
    if (forwardOut && forwardIn) {
      const midY = (from.y + to.y) / 2
      return [{ x: from.x, y: midY }, { x: to.x, y: midY }]
    }
    const midX = (from.x + to.x) / 2
    return [{ x: midX, y: from.y }, { x: midX, y: to.y }]
  }

  if (startH) {
    const forwardOut = !fromNormal || Math.sign(fromNormal.x) === Math.sign(dx)
    return forwardOut ? [{ x: to.x, y: from.y }] : [{ x: from.x, y: to.y }, { x: to.x, y: to.y }]
  }
  const forwardOut = !fromNormal || Math.sign(fromNormal.y) === Math.sign(dy)
  return forwardOut ? [{ x: from.x, y: to.y }] : [{ x: to.x, y: from.y }, { x: to.x, y: to.y }]
}

function resolveWithWaypoints(points: Point[], start: BoundEnd | null, end: BoundEnd | null): Point[] {
  const next = points.map((point) => ({ ...point }))
  if (start) next[0] = start.port
  if (end) next[next.length - 1] = end.port
  return orthogonalizeSegments(next, start?.normal ?? null, end?.normal ?? null)
}

function orthogonalizeSegments(points: Point[], startNormal: Point | null, endNormal: Point | null): Point[] {
  if (points.length < 2) return points
  let routed: Point[] = [points[0]!]
  let nextStartNormal = startNormal
  for (let i = 1; i < points.length; i += 1) {
    const from = routed[routed.length - 1]!
    const to = points[i]!
    const segmentEndNormal = i === points.length - 1 ? endNormal : null
    const segment = orthogonalRoute(from, nextStartNormal, to, segmentEndNormal)
    routed = [...routed, ...segment.slice(1)]
    const previous = segment[segment.length - 2]
    const axis = previous ? axisBetween(previous, to) : null
    const next = points[i + 1]
    nextStartNormal = axis && next ? normalToward(to, next, perpendicularAxis(axis)) : null
  }
  return simplifyRoute(routed)
}

type Axis = 'x' | 'y'

function axisBetween(a: Point, b: Point): Axis | null {
  if (Math.abs(a.x - b.x) <= AXIS_TOLERANCE) return 'y'
  if (Math.abs(a.y - b.y) <= AXIS_TOLERANCE) return 'x'
  return null
}

function perpendicularAxis(axis: Axis): Axis {
  return axis === 'x' ? 'y' : 'x'
}

function normalToward(from: Point, to: Point, axis: Axis): Point | null {
  const delta = axis === 'x' ? to.x - from.x : to.y - from.y
  const direction = sign(delta)
  if (!direction) return null
  return axis === 'x' ? { x: direction, y: 0 } : { x: 0, y: direction }
}

export function arrowNeedsResolve(arrow: ArrowElement): boolean {
  if (arrow.start || arrow.end) return true
  return arrow.points.some((point, index) => {
    if (index === 0) return false
    const prev = arrow.points[index - 1]!
    return Math.abs(prev.x - point.x) > AXIS_TOLERANCE && Math.abs(prev.y - point.y) > AXIS_TOLERANCE
  })
}
