import type { ArrowElement, Binding, Element, ElementId, Point } from '../model/types.js'
import { ROUTE_AXIS_TOLERANCE as AXIS_TOLERANCE, simplifyRoute } from '../geometry/arrow-geometry.js'
import type { Rect } from '../geometry/rect.js'
import { anchorNormal, anchorPoint, sideNormal } from './binding.js'

type Elements = Record<ElementId, Element>

const STUB = 20
const OBSTACLE_PADDING = 16
const MAX_AVOIDANCE_PASSES = 24
const EPSILON = 0.001

interface Obstacle {
  id: ElementId
  rect: Rect
  portal?: Portal
}

interface Collision {
  segmentIndex: number
  obstacle: Obstacle
}

interface Portal {
  port: Point
  normal: Point
}

interface RouteScore {
  collisions: number
  bends: number
  length: number
}

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
  const points = logicalArrowPoints(arrow)
  if (points.length < 2) return points

  const startTarget = arrow.start ? boundTarget(arrow.start, elements) : null
  const endTarget = arrow.end ? boundTarget(arrow.end, elements) : null
  const start = startTarget && arrow.start ? boundEnd(startTarget, arrow.start) : null
  const end = endTarget && arrow.end ? boundEnd(endTarget, arrow.end) : null

  const startPoint = start?.port ?? points[0]!
  const endPoint = end?.port ?? points[points.length - 1]!
  const obstacles = routeObstacles(arrow, elements, { start, end })

  const resolved =
    points.length > 2
      ? resolveWithWaypoints(points, start, end)
      : bestOrthogonalRoute(startPoint, start?.normal ?? null, endPoint, end?.normal ?? null, obstacles)

  return avoidObstacles(resolved, obstacles)
}

function logicalArrowPoints(arrow: ArrowElement): Point[] {
  if (!arrow.start && !arrow.end) return arrow.points.map((point) => ({ ...point }))
  const first = arrow.points[0]
  const last = arrow.points[arrow.points.length - 1]
  return first && last ? [{ ...first }, { ...last }] : arrow.points.map((point) => ({ ...point }))
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

function bestOrthogonalRoute(
  startPoint: Point,
  startNormal: Point | null,
  endPoint: Point,
  endNormal: Point | null,
  obstacles: Obstacle[],
): Point[] {
  const candidates = orthogonalRouteCandidates(startPoint, startNormal, endPoint, endNormal)
  return bestRoute(candidates, obstacles) ?? orthogonalRoute(startPoint, startNormal, endPoint, endNormal)
}

function orthogonalRouteCandidates(
  startPoint: Point,
  startNormal: Point | null,
  endPoint: Point,
  endNormal: Point | null,
): Point[][] {
  const straight = nearStraightRoute(startPoint, startNormal, endPoint, endNormal)
  if (straight) return [straight]

  const startStub = startNormal
    ? { x: startPoint.x + startNormal.x * STUB, y: startPoint.y + startNormal.y * STUB }
    : startPoint
  const endStub = endNormal
    ? { x: endPoint.x + endNormal.x * STUB, y: endPoint.y + endNormal.y * STUB }
    : endPoint

  const candidates: Point[][] = []
  const push = (mids: Point[]) => {
    candidates.push(simplifyRoute([startPoint, startStub, ...mids, endStub, endPoint]))
  }

  if (Math.abs(startStub.x - endStub.x) <= AXIS_TOLERANCE || Math.abs(startStub.y - endStub.y) <= AXIS_TOLERANCE) {
    push([])
    return candidates
  }

  push([{ x: endStub.x, y: startStub.y }])
  push([{ x: startStub.x, y: endStub.y }])

  const midX = (startStub.x + endStub.x) / 2
  const midY = (startStub.y + endStub.y) / 2
  push([{ x: midX, y: startStub.y }, { x: midX, y: endStub.y }])
  push([{ x: startStub.x, y: midY }, { x: endStub.x, y: midY }])

  return candidates
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

function avoidObstacles(points: Point[], obstacles: Obstacle[]): Point[] {
  if (points.length < 2 || obstacles.length === 0) return points

  let next = simplifyRoute(points)
  for (let pass = 0; pass < MAX_AVOIDANCE_PASSES; pass += 1) {
    const collision = firstCollision(next, obstacles)
    if (!collision) return next

    const detour = bestDetour(next, collision, obstacles)
    if (!detour || routesEqual(detour, next)) return next
    next = detour
  }
  return next
}

function routeObstacles(
  arrow: ArrowElement,
  elements: Elements,
  bounds: { start: BoundEnd | null; end: BoundEnd | null },
): Obstacle[] {
  const excluded = new Set<ElementId>([arrow.id])
  const portals = new Map<ElementId, Portal>()
  if (arrow.start && bounds.start) portals.set(arrow.start.elementId, bounds.start)
  if (arrow.end && bounds.end) portals.set(arrow.end.elementId, bounds.end)

  const padding = OBSTACLE_PADDING + arrow.style.strokeWidth / 2
  const obstacles: Obstacle[] = []
  for (const element of Object.values(elements)) {
    if (excluded.has(element.id) || isArrow(element)) continue
    const rect = expandRect(rotatedBounds(element), padding + element.style.strokeWidth / 2)
    if (rect.width <= 0 || rect.height <= 0) continue
    obstacles.push({ id: element.id, rect, portal: portals.get(element.id) })
  }
  return obstacles
}

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}

function firstCollision(points: Point[], obstacles: Obstacle[]): Collision | null {
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex]!
    const end = points[segmentIndex + 1]!
    for (const obstacle of obstacles) {
      if (segmentIntersectsObstacle(start, end, obstacle)) return { segmentIndex, obstacle }
    }
  }
  return null
}

function bestDetour(points: Point[], collision: Collision, obstacles: Obstacle[]): Point[] | null {
  return bestRoute(
    detourCandidates(points, collision).filter((candidate) => !routeIntersectsObstacle(candidate, collision.obstacle)),
    obstacles,
  )
}

function detourCandidates(points: Point[], collision: Collision): Point[][] {
  const a = points[collision.segmentIndex]
  const b = points[collision.segmentIndex + 1]
  if (!a || !b) return []

  const axis = axisBetween(a, b)
  if (!axis) return []

  const segments = axis === 'x' ? horizontalDetours(a, b, collision.obstacle.rect) : verticalDetours(a, b, collision.obstacle.rect)
  return segments.map((segment) =>
    simplifyRoute([...points.slice(0, collision.segmentIndex), ...segment, ...points.slice(collision.segmentIndex + 2)]),
  )
}

function horizontalDetours(a: Point, b: Point, rect: Rect): Point[][] {
  const direction = sign(b.x - a.x)
  if (!direction) return []
  const entryX = direction > 0 ? rect.x : rect.x + rect.width
  const exitX = direction > 0 ? rect.x + rect.width : rect.x
  const lanes = [rect.y, rect.y + rect.height].sort((left, right) => Math.abs(left - a.y) - Math.abs(right - a.y))
  return lanes.map((y) => [
    a,
    { x: entryX, y: a.y },
    { x: entryX, y },
    { x: exitX, y },
    { x: exitX, y: b.y },
    b,
  ])
}

function verticalDetours(a: Point, b: Point, rect: Rect): Point[][] {
  const direction = sign(b.y - a.y)
  if (!direction) return []
  const entryY = direction > 0 ? rect.y : rect.y + rect.height
  const exitY = direction > 0 ? rect.y + rect.height : rect.y
  const lanes = [rect.x, rect.x + rect.width].sort((left, right) => Math.abs(left - a.x) - Math.abs(right - a.x))
  return lanes.map((x) => [
    a,
    { x: a.x, y: entryY },
    { x, y: entryY },
    { x, y: exitY },
    { x: b.x, y: exitY },
    b,
  ])
}

function routeScore(points: Point[], obstacles: Obstacle[]): RouteScore {
  return {
    collisions: countCollisions(points, obstacles),
    bends: countBends(points),
    length: routeLength(points),
  }
}

function bestRoute(candidates: Point[][], obstacles: Obstacle[]): Point[] | null {
  let best: { points: Point[]; score: RouteScore } | null = null
  for (const candidate of candidates) {
    const score = routeScore(candidate, obstacles)
    if (!best || compareRouteScore(score, best.score) < 0) best = { points: candidate, score }
  }
  return best?.points ?? null
}

function compareRouteScore(a: RouteScore, b: RouteScore): number {
  if (a.collisions !== b.collisions) return a.collisions - b.collisions
  if (a.bends !== b.bends) return a.bends - b.bends
  return a.length - b.length
}

function routeIntersectsObstacle(points: Point[], obstacle: Obstacle): boolean {
  return points.some((point, index) => {
    const next = points[index + 1]
    return next ? segmentIntersectsObstacle(point, next, obstacle) : false
  })
}

function countCollisions(points: Point[], obstacles: Obstacle[]): number {
  let count = 0
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!
    const end = points[index + 1]!
    for (const obstacle of obstacles) {
      if (segmentIntersectsObstacle(start, end, obstacle)) count += 1
    }
  }
  return count
}

function countBends(points: Point[]): number {
  let count = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const before = axisBetween(points[index - 1]!, points[index]!)
    const after = axisBetween(points[index]!, points[index + 1]!)
    if (!before || !after || before !== after) count += 1
  }
  return count
}

function routeLength(points: Point[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!
    const b = points[index]!
    length += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return length
}

function segmentIntersectsObstacle(a: Point, b: Point, obstacle: Obstacle): boolean {
  if (!segmentIntersectsRect(a, b, obstacle.rect)) return false
  return !isAllowedPortalSegment(a, b, obstacle.portal)
}

function isAllowedPortalSegment(a: Point, b: Point, portal: Portal | undefined): boolean {
  if (!portal) return false
  if (pointsNearlyEqual(a, portal.port)) return isOutwardFromPortal(b, portal)
  if (pointsNearlyEqual(b, portal.port)) return isOutwardFromPortal(a, portal)
  return false
}

function isOutwardFromPortal(point: Point, portal: Portal): boolean {
  const dx = point.x - portal.port.x
  const dy = point.y - portal.port.y
  return dx * portal.normal.x + dy * portal.normal.y > AXIS_TOLERANCE
}

function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  const axis = axisBetween(a, b)
  if (axis === 'x') {
    const y = (a.y + b.y) / 2
    if (y <= rect.y + EPSILON || y >= rect.y + rect.height - EPSILON) return false
    return rangesOverlapStrict(Math.min(a.x, b.x), Math.max(a.x, b.x), rect.x, rect.x + rect.width)
  }
  if (axis === 'y') {
    const x = (a.x + b.x) / 2
    if (x <= rect.x + EPSILON || x >= rect.x + rect.width - EPSILON) return false
    return rangesOverlapStrict(Math.min(a.y, b.y), Math.max(a.y, b.y), rect.y, rect.y + rect.height)
  }
  return false
}

function rangesOverlapStrict(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return Math.max(aMin, bMin) < Math.min(aMax, bMax) - EPSILON
}

function rotatedBounds(element: Element): Rect {
  const bounds = { x: element.x, y: element.y, width: element.width, height: element.height }
  if (!element.rotation) return bounds

  const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
  const cos = Math.cos(element.rotation)
  const sin = Math.sin(element.rotation)
  const corners: Point[] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const corner of corners) {
    const dx = corner.x - center.x
    const dy = corner.y - center.y
    const x = center.x + dx * cos - dy * sin
    const y = center.y + dx * sin + dy * cos
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function expandRect(rect: Rect, amount: number): Rect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  }
}

function routesEqual(a: Point[], b: Point[]): boolean {
  if (a.length !== b.length) return false
  return a.every((point, index) => pointsNearlyEqual(point, b[index]!))
}

function pointsNearlyEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON
}

export function arrowNeedsResolve(arrow: ArrowElement): boolean {
  if (arrow.start || arrow.end) return true
  return arrow.points.some((point, index) => {
    if (index === 0) return false
    const prev = arrow.points[index - 1]!
    return Math.abs(prev.x - point.x) > AXIS_TOLERANCE && Math.abs(prev.y - point.y) > AXIS_TOLERANCE
  })
}
