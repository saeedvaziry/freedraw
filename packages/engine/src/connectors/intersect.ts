import { elementBounds, elementCenter } from '../geometry/hit-test.js'
import { getOutline } from '../geometry/shape-outline.js'
import type { Element, Point } from '../model/types.js'

function rotate(point: Point, center: Point, angle: number): Point {
  if (!angle) return point
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

function rectPolygon(element: Element): Point[] {
  const { x, y, width, height } = elementBounds(element)
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

function localPolygon(element: Element): Point[] {
  const outline = getOutline(element.type, elementBounds(element))
  if (outline && outline.kind === 'polygon') return outline.points
  return rectPolygon(element)
}

function segmentIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x)
  if (d === 0) return null
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) }
}

function polygonIntersection(outside: Point, inside: Point, polygon: Point[]): Point | null {
  let best: Point | null = null
  let bestDist = Infinity
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    if (!a || !b) continue
    const hit = segmentIntersection(outside, inside, a, b)
    if (!hit) continue
    const dist = (hit.x - outside.x) ** 2 + (hit.y - outside.y) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = hit
    }
  }
  return best
}

function ellipseIntersection(outside: Point, element: Element): Point | null {
  const center = elementCenter(element)
  const rx = element.width / 2
  const ry = element.height / 2
  if (rx === 0 || ry === 0) return center
  const dx = outside.x - center.x
  const dy = outside.y - center.y
  const denom = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)
  if (denom === 0) return center
  const t = 1 / Math.sqrt(denom)
  return { x: center.x + dx * t, y: center.y + dy * t }
}

export function intersectRay(element: Element, anchor: Point, toward: Point): Point {
  const center = elementCenter(element)
  const localAnchor = rotate(anchor, center, -element.rotation)
  const localToward = rotate(toward, center, -element.rotation)

  if (element.type === 'ellipse') {
    const local = ellipseIntersection(localToward, element) ?? localAnchor
    return rotate(local, center, element.rotation)
  }

  const hit = polygonIntersection(localToward, localAnchor, localPolygon(element))
  if (!hit) return rotate(localAnchor, center, element.rotation)
  return rotate(hit, center, element.rotation)
}
