import { elementBounds, elementCenter } from '../geometry/hitTest.js'
import type { Binding, Element, Point } from '../model/types.js'

export const DEFAULT_GAP = 0

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

export function anchorPoint(element: Element, anchor: { nx: number; ny: number }): Point {
  const { x, y, width, height } = elementBounds(element)
  const local: Point = { x: x + anchor.nx * width, y: y + anchor.ny * height }
  return rotate(local, elementCenter(element), element.rotation)
}

export function anchorNormal(element: Element, anchor: { nx: number; ny: number }): Point {
  const distToVerticalEdge = Math.min(anchor.nx, 1 - anchor.nx)
  const distToHorizontalEdge = Math.min(anchor.ny, 1 - anchor.ny)
  const axisX = distToVerticalEdge <= distToHorizontalEdge
  const vector = axisX
    ? { x: anchor.nx < 0.5 ? -1 : 1, y: 0 }
    : { x: 0, y: anchor.ny < 0.5 ? -1 : 1 }
  return rotateVector(vector, element.rotation)
}

function rotateVector(vector: Point, angle: number): Point {
  if (!angle) return vector
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos }
}

export function anchorFromPoint(element: Element, world: Point): { nx: number; ny: number } {
  const { x, y, width, height } = elementBounds(element)
  const local = rotate(world, elementCenter(element), -element.rotation)
  return {
    nx: width === 0 ? 0.5 : clamp01((local.x - x) / width),
    ny: height === 0 ? 0.5 : clamp01((local.y - y) / height),
  }
}

export function createBinding(element: Element, world: Point, gap = DEFAULT_GAP): Binding {
  return { elementId: element.id, anchor: anchorFromPoint(element, world), gap }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
