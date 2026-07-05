import type { Element, Point } from '../model/types.js'
import { elementBounds, elementCenter } from './hit-test.js'
import type { Rect } from './rect.js'

export function rotatePoint(point: Point, center: Point, angle: number): Point {
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

export function rotateVector(vector: Point, angle: number): Point {
  if (!angle) return vector
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos }
}

export function rotatedBounds(element: Element): Rect {
  const bounds = elementBounds(element)
  if (!element.rotation) return bounds

  const center = elementCenter(element)
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
    const rotated = rotatePoint(corner, center, element.rotation)
    minX = Math.min(minX, rotated.x)
    minY = Math.min(minY, rotated.y)
    maxX = Math.max(maxX, rotated.x)
    maxY = Math.max(maxY, rotated.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
