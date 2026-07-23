import type { ArrowElement, Element, ElementId, Point, SceneSnapshot } from '../model/types.js'
import { arrowRoute } from '../connectors/resolve.js'
import { isArrowElement } from '../model/guards.js'
import { expand, intersects, type Rect } from './rect.js'
import { rotatePoint, rotatedBounds } from './rotate.js'
import { getOutline, pointInPolygon } from './shape-outline.js'
import { arrowLabelHitRect } from '../text/arrow-label.js'

const HIT_TOLERANCE = 6

export function elementBounds(element: Element): Rect {
  return { x: element.x, y: element.y, width: element.width, height: element.height }
}

export function elementCenter(element: Element): Point {
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 }
}

export function toLocalPoint(point: Point, element: Element): Point {
  return rotatePoint(point, elementCenter(element), -element.rotation)
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
  if (isArrowElement(element)) {
    return hitPolyline(point, arrowRoute(element as ArrowElement), element) || hitArrowLabel(point, element)
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
    if (!element || element.locked) continue
    const broad = expand(hitBounds(element), element.style.strokeWidth / 2 + HIT_TOLERANCE)
    if (!pointInRect(point, broad, 0)) continue
    if (hitTestElement(point, element)) return element
  }
  return null
}

function hitBounds(element: Element): Rect {
  const bounds = rotatedBounds(element)
  if (!isArrowElement(element) || !element.label?.text) return bounds

  return unionRect(bounds, arrowLabelHitRect(arrowRoute(element), element.label.text, element.style))
}

function hitArrowLabel(point: Point, element: ArrowElement): boolean {
  if (!element.label?.text) return false
  return pointInRect(point, arrowLabelHitRect(arrowRoute(element), element.label.text, element.style), 0)
}

function unionRect(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function nearestShape(point: Point, snapshot: SceneSnapshot, margin: number): Element | null {
  for (let i = snapshot.order.length - 1; i >= 0; i -= 1) {
    const id = snapshot.order[i]
    if (!id) continue
    const element = snapshot.elements[id]
    if (!element || isArrowElement(element)) continue
    const broad = expand(rotatedBounds(element), margin)
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
    const aabb = rotatedBounds(element)
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
    if (!element || element.locked) continue
    if (intersects(rotatedBounds(element), marquee)) hits.push(element)
  }
  return hits
}

export function groupMembers(snapshot: SceneSnapshot, groupId: ElementId): ElementId[] {
  const members: ElementId[] = []
  for (const id of snapshot.order) {
    if (snapshot.elements[id]?.groupId === groupId) members.push(id)
  }
  return members
}

export function expandGroupSelection(ids: Iterable<ElementId>, snapshot: SceneSnapshot): Set<ElementId> {
  const result = new Set<ElementId>()
  const groups = new Set<ElementId>()
  for (const id of ids) {
    const element = snapshot.elements[id]
    if (!element) continue
    result.add(id)
    if (element.groupId) groups.add(element.groupId)
  }
  for (const groupId of groups) {
    for (const memberId of groupMembers(snapshot, groupId)) result.add(memberId)
  }
  return result
}
