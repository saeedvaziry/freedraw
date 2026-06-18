import { elementBounds, elementCenter } from '../geometry/hit-test.js'
import type { Binding, Element, Point } from '../model/types.js'

export const DEFAULT_GAP = 0
type BindingSide = NonNullable<Binding['side']>

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
  return sideNormal(element, anchorSide(anchor))
}

export function sideNormal(element: Element, side: BindingSide): Point {
  return rotateVector(sideVector(side), element.rotation)
}

function anchorSide(anchor: { nx: number; ny: number }): BindingSide {
  const distToVerticalEdge = Math.min(anchor.nx, 1 - anchor.nx)
  const distToHorizontalEdge = Math.min(anchor.ny, 1 - anchor.ny)
  const axisX = distToVerticalEdge < distToHorizontalEdge
  if (axisX) return anchor.nx < 0.5 ? 'left' : 'right'
  return anchor.ny < 0.5 ? 'top' : 'bottom'
}

export function bindingSide(element: Element, world: Point, source: Point = world): BindingSide {
  const { x, y, width, height } = elementBounds(element)
  const center = elementCenter(element)
  const local = rotate(world, center, -element.rotation)
  const localSource = rotate(source, center, -element.rotation)
  const left = Math.abs(local.x - x)
  const right = Math.abs(local.x - (x + width))
  const top = Math.abs(local.y - y)
  const bottom = Math.abs(local.y - (y + height))
  const vertical = Math.min(left, right)
  const horizontal = Math.min(top, bottom)
  const ambiguous = Math.abs(vertical - horizontal) < 0.5
  const axisX = ambiguous ? Math.abs(localSource.x - local.x) > Math.abs(localSource.y - local.y) : vertical < horizontal
  if (axisX) return left < right ? 'left' : 'right'
  return top < bottom ? 'top' : 'bottom'
}

function sideVector(side: BindingSide): Point {
  if (side === 'left') return { x: -1, y: 0 }
  if (side === 'right') return { x: 1, y: 0 }
  if (side === 'top') return { x: 0, y: -1 }
  return { x: 0, y: 1 }
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

export function createBinding(element: Element, world: Point, gap = DEFAULT_GAP, source: Point = world): Binding {
  return { elementId: element.id, anchor: anchorFromPoint(element, world), gap, side: bindingSide(element, world, source) }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
