import { simplifyRoute } from '../../geometry/arrow-geometry.js'
import { pointsBounds } from '../../model/factory.js'
import type { ArrowElement, Binding, Element, ElementId, Point } from '../../model/types.js'
import { anchorPoint, sideNormal } from '../binding.js'
import { intersectRay } from '../intersect.js'
import { findRoute } from './astar.js'
import { buildLattice } from './lattice.js'
import { collectRouteObstacles, type BoundPort, type Obstacle } from './obstacles.js'

export interface PortSpec {
  point: Point
  normal: Point | null
}

export interface RouteRequest {
  start: PortSpec
  end: PortSpec
  obstacles: Obstacle[]
  waypoints?: Point[]
}

const STUB = 20
const AXIS_EPSILON = 0.001

type Elements = Record<ElementId, Element>

type BoundEnd = BoundPort

export function routeArrow(request: RouteRequest): Point[] {
  const points = [request.start.point, ...(request.waypoints ?? []), request.end.point]
  if (points.length < 2) return points.map(clonePoint)
  if (points.length > 2) return routeViaWaypoints(request)
  return routeLeg(request.start, request.end, request.obstacles)
}

export function resolveArrowPoints(arrow: ArrowElement, elements: Elements): Point[] {
  const points = logicalArrowPoints(arrow)
  if (points.length < 2) return points

  const startTarget = arrow.start ? elements[arrow.start.elementId] ?? null : null
  const endTarget = arrow.end ? elements[arrow.end.elementId] ?? null : null
  const start = startTarget && arrow.start ? boundEnd(arrow, startTarget, arrow.start) : null
  const end = endTarget && arrow.end ? boundEnd(arrow, endTarget, arrow.end) : null

  if (arrow.routing === 'straight') {
    return straightRoute(arrow, points, { start, end }, { startTarget, endTarget })
  }

  const startPoint = start?.port ?? points[0]!
  const endPoint = end?.port ?? points[points.length - 1]!
  const obstacles = collectRouteObstacles(arrow, elements, { start, end })
  const waypoints = points.slice(1, -1)
  return routeArrow({
    start: { point: startPoint, normal: start?.normal ?? null },
    end: { point: endPoint, normal: end?.normal ?? null },
    obstacles,
    waypoints,
  })
}

export function arrowRoute(arrow: ArrowElement): Point[] {
  return Array.isArray(arrow.route) && arrow.route.length >= 2 ? arrow.route : arrow.points
}

export function resolvedArrowBounds(arrow: ArrowElement, elements: Elements): Pick<ArrowElement, 'x' | 'y' | 'width' | 'height'> {
  return pointsBounds(resolveArrowPoints(arrow, elements))
}

function routeViaWaypoints(request: RouteRequest): Point[] {
  const points = [request.start.point, ...(request.waypoints ?? []), request.end.point]
  let routed: Point[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const start: PortSpec = {
      point: points[i]!,
      normal: i === 0 ? request.start.normal : null,
    }
    const end: PortSpec = {
      point: points[i + 1]!,
      normal: i === points.length - 2 ? request.end.normal : null,
    }
    const leg = routeLeg(start, end, request.obstacles)
    routed = routed.length === 0 ? leg : [...routed, ...leg.slice(1)]
  }
  return simplifyRoute(routed)
}

function routeLeg(start: PortSpec, end: PortSpec, obstacles: Obstacle[]): Point[] {
  if (pointsEqual(start.point, end.point)) return [clonePoint(start.point), clonePoint(end.point)]
  const startStub = stubPoint(start)
  const endStub = stubPoint(end)
  const lattice = buildLattice(startStub, endStub, obstacles)
  const search = lattice ? findRoute(lattice) : null
  const middle = search && search.length > 0 ? search : fallbackMiddle(startStub, endStub)
  return simplifyRoute([start.point, startStub, ...middle.slice(1, -1), endStub, end.point].map(clonePoint))
}

function fallbackMiddle(start: Point, end: Point): Point[] {
  if (Math.abs(start.x - end.x) <= AXIS_EPSILON || Math.abs(start.y - end.y) <= AXIS_EPSILON) return [start, end]
  const midX = (start.x + end.x) / 2
  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
}

function stubPoint(port: PortSpec): Point {
  if (!port.normal) return port.point
  return { x: port.point.x + port.normal.x * STUB, y: port.point.y + port.normal.y * STUB }
}

function logicalArrowPoints(arrow: ArrowElement): Point[] {
  return arrow.points.map(clonePoint)
}

function boundEnd(arrow: ArrowElement, target: Element, binding: Binding): BoundEnd {
  const normal = axisNormal(sideNormal(target, binding.side))
  const gap = Math.max(binding.gap, arrow.style.strokeWidth / 2)
  const anchor = anchorPoint(target, binding.anchor)
  return {
    elementId: target.id,
    port: { x: anchor.x + normal.x * gap, y: anchor.y + normal.y * gap },
    normal,
  }
}

function straightRoute(
  arrow: ArrowElement,
  points: Point[],
  bounds: { start: BoundEnd | null; end: BoundEnd | null },
  targets: { startTarget: Element | null; endTarget: Element | null },
): Point[] {
  const next = points.map(clonePoint)
  if (bounds.start && targets.startTarget) {
    const toward = next[1] ?? bounds.start.port
    next[0] = straightBoundPoint(arrow, targets.startTarget, arrow.start!, toward)
  }
  if (bounds.end && targets.endTarget) {
    const toward = next[next.length - 2] ?? bounds.end.port
    next[next.length - 1] = straightBoundPoint(arrow, targets.endTarget, arrow.end!, toward)
  }
  return next
}

function straightBoundPoint(arrow: ArrowElement, target: Element, binding: Binding, toward: Point): Point {
  const normal = axisNormal(sideNormal(target, binding.side))
  const gap = Math.max(binding.gap, arrow.style.strokeWidth / 2)
  const anchor = anchorPoint(target, binding.anchor)
  const clipped = intersectRay(target, anchor, toward)
  return { x: clipped.x + normal.x * gap, y: clipped.y + normal.y * gap }
}

function axisNormal(normal: Point): Point {
  if (Math.abs(normal.x) >= Math.abs(normal.y)) return { x: Math.sign(normal.x) || 1, y: 0 }
  return { x: 0, y: Math.sign(normal.y) || 1 }
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= AXIS_EPSILON && Math.abs(a.y - b.y) <= AXIS_EPSILON
}
