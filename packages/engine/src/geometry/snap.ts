import type { Element, Point, SceneSnapshot } from '../model/types.js'
import { GRID_SNAP_SIZE, snapPointToGrid, snapValueToGrid } from './grid.js'
import { elementBounds, elementCenter, hitTestElement, toLocalPoint } from './hitTest.js'
import { getOutline, type Outline } from './shapeOutline.js'

export const SNAP_DISTANCE = 8
const EDGE_CENTER_MAGNET_FACTOR = 0.5

export type SnapGuide =
  | { kind: 'point'; at: Point }
  | { kind: 'line'; from: Point; to: Point }
  | { kind: 'align'; from: Point; to: Point }
  | { kind: 'distance'; from: Point; to: Point; label: number }

export interface SnapResult {
  point: Point
  guides: SnapGuide[]
  target: Element | null
}

export function shapeAnchors(element: Element): Point[] {
  const { x, y, width, height } = elementBounds(element)
  const center = elementCenter(element)
  return rotateAll(
    [
      { x: x + width / 2, y },
      { x: x + width, y: y + height / 2 },
      { x: x + width / 2, y: y + height },
      { x, y: y + height / 2 },
    ],
    center,
    element.rotation,
  )
}

function rotateAll(points: Point[], center: Point, angle: number): Point[] {
  if (!angle) return points
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points.map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
  })
}

export function snapToShapes(
  world: Point,
  snapshot: SceneSnapshot,
  threshold: number,
  ignoreId?: string,
): { point: Point; target: Element | null } {
  let best: Point | null = null
  let bestTarget: Element | null = null
  let bestDist = threshold
  for (const id of snapshot.order) {
    if (id === ignoreId) continue
    const element = snapshot.elements[id]
    if (!element || element.type === 'arrow' || element.type === 'line') continue
    for (const anchor of shapeAnchors(element)) {
      const dist = Math.hypot(anchor.x - world.x, anchor.y - world.y)
      if (dist < bestDist) {
        bestDist = dist
        best = anchor
        bestTarget = element
      }
    }
  }
  return { point: best ?? world, target: best ? bestTarget : null }
}

function snapToShapeSurface(
  world: Point,
  snapshot: SceneSnapshot,
  threshold: number,
  ignoreId?: string,
): { point: Point; target: Element | null } {
  let best: Point | null = null
  let bestTarget: Element | null = null
  let bestDist = threshold * threshold
  for (const id of snapshot.order) {
    if (id === ignoreId) continue
    const element = snapshot.elements[id]
    if (!element || element.type === 'arrow' || element.type === 'line') continue
    const surface = nearestSurfacePoint(element, world)
    const dist = squaredDistance(world, surface)
    if (dist >= bestDist) continue
    best = surface
    bestTarget = element
    bestDist = dist
  }
  return { point: best ?? world, target: bestTarget }
}

function nearestSurfacePoint(element: Element, world: Point): Point {
  const bounds = elementBounds(element)
  const outline = getOutline(element.type, bounds, element.style.roundness)
  const local = toLocalPoint(world, element)
  const center = elementCenter(element)
  const surface = outline ? closestPointOnOutline(local, outline, bounds) : closestPointOnRect(local, bounds)
  return rotate(surface, center, element.rotation)
}

function closestPointOnOutline(point: Point, outline: Outline, bounds: ReturnType<typeof elementBounds>): Point {
  if (outline.kind === 'polygon') return closestPointOnPolygon(point, outline.points)
  if (outline.kind === 'ellipse') return closestPointOnEllipse(point, outline)
  return closestPointOnRect(point, bounds)
}

function closestPointOnPolygon(point: Point, points: Point[]): Point {
  let best = points[0] ?? point
  let bestDist = Infinity
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    if (!a || !b) continue
    const candidate = closestPointOnSegment(point, a, b)
    const dist = squaredDistance(point, candidate)
    if (dist >= bestDist) continue
    best = candidate
    bestDist = dist
  }
  return best
}

function closestPointOnSegment(point: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return a
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

function closestPointOnEllipse(point: Point, ellipse: Extract<Outline, { kind: 'ellipse' }>): Point {
  if (ellipse.rx === 0 || ellipse.ry === 0) return { x: ellipse.cx, y: ellipse.cy }
  const dx = point.x - ellipse.cx
  const dy = point.y - ellipse.cy
  if (dx === 0 && dy === 0) return { x: ellipse.cx, y: ellipse.cy - ellipse.ry }
  const scale = 1 / Math.sqrt((dx * dx) / (ellipse.rx * ellipse.rx) + (dy * dy) / (ellipse.ry * ellipse.ry))
  return { x: ellipse.cx + dx * scale, y: ellipse.cy + dy * scale }
}

function closestPointOnRect(point: Point, rect: ReturnType<typeof elementBounds>): Point {
  const left = Math.abs(point.x - rect.x)
  const right = Math.abs(point.x - (rect.x + rect.width))
  const top = Math.abs(point.y - rect.y)
  const bottom = Math.abs(point.y - (rect.y + rect.height))
  const min = Math.min(left, right, top, bottom)
  const x = Math.max(rect.x, Math.min(rect.x + rect.width, point.x))
  const y = Math.max(rect.y, Math.min(rect.y + rect.height, point.y))
  if (min === left) return { x: rect.x, y }
  if (min === right) return { x: rect.x + rect.width, y }
  if (min === top) return { x, y: rect.y }
  return { x, y: rect.y + rect.height }
}

function rotate(point: Point, center: Point, angle: number): Point {
  if (!angle) return point
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
}

function squaredDistance(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

function shapeUnder(world: Point, snapshot: SceneSnapshot, ignoreId?: string): Element | null {
  for (let i = snapshot.order.length - 1; i >= 0; i -= 1) {
    const id = snapshot.order[i]
    if (!id || id === ignoreId) continue
    const element = snapshot.elements[id]
    if (!element || element.type === 'arrow' || element.type === 'line') continue
    if (hitTestElement(world, element)) return element
  }
  return null
}

export function snapEndpoint(
  world: Point,
  snapshot: SceneSnapshot,
  options: { threshold: number; origin?: Point; ignoreId?: string },
): SnapResult {
  const shapeSnap = snapToShapes(world, snapshot, options.threshold * EDGE_CENTER_MAGNET_FACTOR, options.ignoreId)
  if (shapeSnap.target) {
    return { point: shapeSnap.point, target: shapeSnap.target, guides: [{ kind: 'point', at: shapeSnap.point }] }
  }
  const surfaceSnap = snapToShapeSurface(world, snapshot, options.threshold, options.ignoreId)
  if (surfaceSnap.target) {
    return { point: surfaceSnap.point, target: surfaceSnap.target, guides: [{ kind: 'point', at: surfaceSnap.point }] }
  }
  const over = shapeUnder(world, snapshot, options.ignoreId)
  if (over) {
    const port = nearestSurfacePoint(over, world)
    return { point: port, target: over, guides: [{ kind: 'point', at: port }] }
  }
  if (options.origin) return { point: snapToGridAxis(world, options.origin, options.threshold), target: null, guides: [] }
  return { point: snapPointToGrid(world), target: null, guides: [] }
}

function snapToGridAxis(world: Point, origin: Point, threshold: number): Point {
  const axisThreshold = Math.max(threshold, GRID_SNAP_SIZE)
  const dx = Math.abs(world.x - origin.x)
  const dy = Math.abs(world.y - origin.y)
  if (dy <= axisThreshold && dy * 2 <= dx) return { x: snapValueToGrid(world.x), y: origin.y }
  if (dx <= axisThreshold && dx * 2 <= dy) return { x: origin.x, y: snapValueToGrid(world.y) }
  return snapPointToGrid(world)
}
