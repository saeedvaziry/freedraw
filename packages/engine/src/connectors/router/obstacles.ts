import type { ArrowElement, Element, ElementId, Point } from '../../model/types.js'
import { isArrowElement } from '../../model/guards.js'
import { expand, intersects, type Rect } from '../../geometry/rect.js'
import { rotatedBounds } from '../../geometry/rotate.js'

export const OBSTACLE_PADDING = 16
export const GEOMETRY_EPSILON = 0.001

export interface Portal {
  port: Point
  normal: Point
}

export interface Obstacle {
  id: ElementId
  rect: Rect
  portal?: Portal
}

export interface BoundPort {
  elementId: ElementId
  port: Point
  normal: Point
}

export function collectRouteObstacles(
  arrow: ArrowElement,
  elements: Record<ElementId, Element>,
  ports: { start: BoundPort | null; end: BoundPort | null },
): Obstacle[] {
  const portals = new Map<ElementId, Portal>()
  if (ports.start) portals.set(ports.start.elementId, ports.start)
  if (ports.end) portals.set(ports.end.elementId, ports.end)

  const obstacles: Obstacle[] = []
  const padding = OBSTACLE_PADDING + arrow.style.strokeWidth / 2
  for (const element of Object.values(elements)) {
    if (element.id === arrow.id || isArrowElement(element)) continue
    const rect = expand(rotatedBounds(element), padding + element.style.strokeWidth / 2)
    if (rect.width <= 0 || rect.height <= 0) continue
    obstacles.push({ id: element.id, rect, portal: portals.get(element.id) })
  }
  return obstacles
}

export function obstaclesInRegion(obstacles: Obstacle[], region: Rect): Obstacle[] {
  return obstacles.filter((obstacle) => intersects(obstacle.rect, region))
}

export function pointInObstacle(point: Point, obstacle: Obstacle): boolean {
  return pointInRectStrict(point, obstacle.rect)
}

export function pointInAnyObstacle(point: Point, obstacles: Obstacle[]): boolean {
  return obstacles.some((obstacle) => pointInObstacle(point, obstacle))
}

export function segmentIntersectsObstacle(a: Point, b: Point, obstacle: Obstacle): boolean {
  if (!segmentIntersectsRect(a, b, obstacle.rect)) return false
  return !isAllowedPortalSegment(a, b, obstacle.portal)
}

export function segmentIntersectsAnyObstacle(a: Point, b: Point, obstacles: Obstacle[]): boolean {
  return obstacles.some((obstacle) => segmentIntersectsObstacle(a, b, obstacle))
}

export function routeIntersectsAnyObstacle(points: Point[], obstacles: Obstacle[]): boolean {
  return points.some((point, index) => {
    const next = points[index + 1]
    return next ? segmentIntersectsAnyObstacle(point, next, obstacles) : false
  })
}

export function rectFromPoints(points: Point[], margin = 0): Rect {
  if (points.length === 0) return { x: -margin, y: -margin, width: margin * 2, height: margin * 2 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX - margin, y: minY - margin, width: maxX - minX + margin * 2, height: maxY - minY + margin * 2 }
}

function pointInRectStrict(point: Point, rect: Rect): boolean {
  return (
    point.x > rect.x + GEOMETRY_EPSILON &&
    point.x < rect.x + rect.width - GEOMETRY_EPSILON &&
    point.y > rect.y + GEOMETRY_EPSILON &&
    point.y < rect.y + rect.height - GEOMETRY_EPSILON
  )
}

function segmentIntersectsRect(a: Point, b: Point, rect: Rect): boolean {
  if (Math.abs(a.y - b.y) <= GEOMETRY_EPSILON) {
    const y = (a.y + b.y) / 2
    if (y <= rect.y + GEOMETRY_EPSILON || y >= rect.y + rect.height - GEOMETRY_EPSILON) return false
    return rangesOverlapStrict(Math.min(a.x, b.x), Math.max(a.x, b.x), rect.x, rect.x + rect.width)
  }
  if (Math.abs(a.x - b.x) <= GEOMETRY_EPSILON) {
    const x = (a.x + b.x) / 2
    if (x <= rect.x + GEOMETRY_EPSILON || x >= rect.x + rect.width - GEOMETRY_EPSILON) return false
    return rangesOverlapStrict(Math.min(a.y, b.y), Math.max(a.y, b.y), rect.y, rect.y + rect.height)
  }
  return false
}

function rangesOverlapStrict(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return Math.max(aMin, bMin) < Math.min(aMax, bMax) - GEOMETRY_EPSILON
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
  return dx * portal.normal.x + dy * portal.normal.y > GEOMETRY_EPSILON
}

function pointsNearlyEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= GEOMETRY_EPSILON && Math.abs(a.y - b.y) <= GEOMETRY_EPSILON
}
