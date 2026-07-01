import type { ArrowElement, Element, Point, SceneSnapshot } from '../model/types.js'
import { arrowRoute } from '../connectors/resolve.js'
import { expand, intersects, type Rect } from './rect.js'
import { getOutline, pointInPolygon } from './shape-outline.js'

const HIT_TOLERANCE = 6

export function elementBounds(element: Element): Rect {
  return { x: element.x, y: element.y, width: element.width, height: element.height }
}

export function elementCenter(element: Element): Point {
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 }
}

export function toLocalPoint(point: Point, element: Element): Point {
  if (!element.rotation) return point
  const center = elementCenter(element)
  const cos = Math.cos(-element.rotation)
  const sin = Math.sin(-element.rotation)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

function rotatedAabb(element: Element): Rect {
  const bounds = elementBounds(element)
  if (!element.rotation) return bounds
  const center = elementCenter(element)
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

function pointInRect(point: Point, rect: Rect, tolerance: number): boolean {
  return (
    point.x >= rect.x - tolerance &&
    point.x <= rect.x + rect.width + tolerance &&
    point.y >= rect.y - tolerance &&
    point.y <= rect.y + rect.height + tolerance
  )
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

function distanceToPolyline(point: Point, points: Point[]): number {
  let min = Infinity
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    if (!a || !b) continue
    min = Math.min(min, distanceToSegment(point, a, b))
  }
  return min
}

function hitPolyline(local: Point, points: Point[], element: Element): boolean {
  if (points.length < 2) return false
  return distanceToPolyline(local, points) <= element.style.strokeWidth / 2 + HIT_TOLERANCE
}

function hitShape(local: Point, element: Element): boolean {
  const outline = getOutline(element.type, elementBounds(element), element.style.roundness)
  if (!outline) return pointInRect(local, elementBounds(element), HIT_TOLERANCE)

  const filled = element.style.fill !== 'transparent'
  if (outline.kind === 'ellipse') {
    const nx = (local.x - outline.cx) / (outline.rx || 1)
    const ny = (local.y - outline.cy) / (outline.ry || 1)
    const distance = Math.abs(Math.hypot(nx, ny) - 1) * Math.min(outline.rx, outline.ry)
    if (filled) return nx * nx + ny * ny <= 1 || distance <= element.style.strokeWidth / 2 + HIT_TOLERANCE
    return distance <= element.style.strokeWidth / 2 + HIT_TOLERANCE
  }
  if (outline.kind === 'polygon') {
    const edges = [...outline.points, outline.points[0]].filter(Boolean) as Point[]
    if (filled) return pointInPolygon(local, outline.points) || hitPolyline(local, edges, element)
    if (pointInPolygon(local, outline.points)) return true
    return hitPolyline(local, edges, element)
  }
  return pointInRect(local, elementBounds(element), HIT_TOLERANCE)
}

export function hitTestElement(point: Point, element: Element): boolean {
  if (element.type === 'arrow' || element.type === 'line') {
    return hitPolyline(point, arrowRoute(element as ArrowElement), element)
  }
  const local = toLocalPoint(point, element)
  if (element.type === 'freedraw') return hitPolyline(local, element.points, element)
  if (element.type === 'text' || element.type === 'sticky' || element.type === 'image') {
    return pointInRect(local, elementBounds(element), HIT_TOLERANCE)
  }
  return hitShape(local, element)
}

export function hitTest(point: Point, snapshot: SceneSnapshot): Element | null {
  for (let i = snapshot.order.length - 1; i >= 0; i -= 1) {
    const id = snapshot.order[i]
    if (!id) continue
    const element = snapshot.elements[id]
    if (!element) continue
    const broad = expand(rotatedAabb(element), element.style.strokeWidth / 2 + HIT_TOLERANCE)
    if (!pointInRect(point, broad, 0)) continue
    if (hitTestElement(point, element)) return element
  }
  return null
}

export function nearestShape(point: Point, snapshot: SceneSnapshot, margin: number): Element | null {
  for (let i = snapshot.order.length - 1; i >= 0; i -= 1) {
    const id = snapshot.order[i]
    if (!id) continue
    const element = snapshot.elements[id]
    if (!element || element.type === 'arrow' || element.type === 'line') continue
    const broad = expand(rotatedAabb(element), margin)
    if (pointInRect(point, broad, 0)) return element
  }
  return null
}

export function selectionBounds(elements: Element[]): Rect | null {
  if (elements.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const element of elements) {
    const aabb = rotatedAabb(element)
    minX = Math.min(minX, aabb.x)
    minY = Math.min(minY, aabb.y)
    maxX = Math.max(maxX, aabb.x + aabb.width)
    maxY = Math.max(maxY, aabb.y + aabb.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function marqueeHits(marquee: Rect, snapshot: SceneSnapshot): Element[] {
  const hits: Element[] = []
  for (const id of snapshot.order) {
    const element = snapshot.elements[id]
    if (!element) continue
    if (intersects(rotatedAabb(element), marquee)) hits.push(element)
  }
  return hits
}
