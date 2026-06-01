import type { ArrowElement, Binding, Element, ElementId, Point } from '../model/types.js'
import { anchorNormal, anchorPoint } from './binding.js'

type Elements = Record<ElementId, Element>

const STUB = 20
const STRAIGHT_TOLERANCE = 48

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
  const normal = anchorNormal(target, anchor)
  return { port: pullBack(anchorPoint(target, anchor), normal, binding.gap), normal }
}

function isHorizontal(normal: Point): boolean {
  return Math.abs(normal.x) >= Math.abs(normal.y)
}

function sign(value: number): number {
  if (Math.abs(value) < 0.5) return 0
  return Math.sign(value)
}

export function resolveArrowPoints(arrow: ArrowElement, elements: Elements): Point[] {
  const points = arrow.points.map((point) => ({ ...point }))
  if (points.length < 2) return points

  const startTarget = arrow.start ? boundTarget(arrow.start, elements) : null
  const endTarget = arrow.end ? boundTarget(arrow.end, elements) : null
  const start = startTarget && arrow.start ? boundEnd(startTarget, arrow.start) : null
  const end = endTarget && arrow.end ? boundEnd(endTarget, arrow.end) : null

  const bothBound = Boolean(start && end)
  if (points.length > 2 && !bothBound) return resolveWithWaypoints(points, start, end)

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
  return simplify([startPoint, startStub, ...mids, endStub, endPoint])
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
    Math.abs(dx) <= STRAIGHT_TOLERANCE &&
    normalAllowsVertical(startNormal, sign(dy)) &&
    normalAllowsVertical(endNormal, sign(-dy))
  ) {
    return [startPoint, endPoint]
  }
  if (
    Math.abs(dy) <= STRAIGHT_TOLERANCE &&
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
  if (Math.abs(dx) < 0.5 || Math.abs(dy) < 0.5) return []

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

function simplify(points: Point[]): Point[] {
  const deduped: Point[] = []
  for (const point of points) {
    const last = deduped[deduped.length - 1]
    if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) continue
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

function isCollinear(a: Point, b: Point, c: Point): boolean {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return Math.abs(cross) < 0.5
}

function resolveWithWaypoints(points: Point[], start: BoundEnd | null, end: BoundEnd | null): Point[] {
  const next = points.map((point) => ({ ...point }))
  if (start) next[0] = start.port
  if (end) next[next.length - 1] = end.port
  return next
}

export function arrowNeedsResolve(arrow: ArrowElement): boolean {
  return Boolean(arrow.start || arrow.end)
}
