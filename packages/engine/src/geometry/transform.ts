import type { Element, Point } from '../model/types.js'
import { GRID_SIZE } from './grid.js'
import type { Rect } from './rect.js'
import type { ResizeHandleId, SelectionFrame } from './handles.js'

export interface ResizeResult {
  id: string
  patch: Partial<Element>
}

const MIN_DIMENSION = GRID_SIZE

function unrotate(point: Point, center: Point, rotation: number): Point {
  if (!rotation) return point
  const cos = Math.cos(-rotation)
  const sin = Math.sin(-rotation)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function resizedBounds(
  frame: SelectionFrame,
  handle: ResizeHandleId,
  pointer: Point,
): Rect {
  const local = unrotate(pointer, frame.center, frame.rotation)
  let left = frame.bounds.x
  let top = frame.bounds.y
  let right = frame.bounds.x + frame.bounds.width
  let bottom = frame.bounds.y + frame.bounds.height

  if (handle.includes('w')) left = local.x
  if (handle.includes('e')) right = local.x
  if (handle.includes('n')) top = local.y
  if (handle.includes('s')) bottom = local.y

  const x = Math.min(left, right)
  const y = Math.min(top, bottom)
  return {
    x,
    y,
    width: Math.max(MIN_DIMENSION, Math.abs(right - left)),
    height: Math.max(MIN_DIMENSION, Math.abs(bottom - top)),
  }
}

function resizeLabelFloor(label: Element['label'], width: number, height: number): Element['label'] | null {
  if (!label || label.baseWidth === undefined || label.baseHeight === undefined) return null
  return { ...label, baseWidth: width, baseHeight: height }
}

export function resizeElements(
  elements: Element[],
  frame: SelectionFrame,
  next: Rect,
): ResizeResult[] {
  const sx = next.width / frame.bounds.width
  const sy = next.height / frame.bounds.height
  return elements.map((element) => {
    const x = next.x + (element.x - frame.bounds.x) * sx
    const y = next.y + (element.y - frame.bounds.y) * sy
    const width = Math.max(MIN_DIMENSION, element.width * sx)
    const height = Math.max(MIN_DIMENSION, element.height * sy)
    if (element.type === 'freedraw') {
      const points = element.points.map((point) => ({
        x: x + (point.x - element.x) * sx,
        y: y + (point.y - element.y) * sy,
      }))
      return { id: element.id, patch: { x, y, width, height, points } }
    }
    const label = resizeLabelFloor(element.label, width, height)
    return { id: element.id, patch: { x, y, width, height, ...(label ? { label } : {}) } }
  })
}

export function rotationFor(frame: SelectionFrame, pointer: Point): number {
  return Math.atan2(pointer.y - frame.center.y, pointer.x - frame.center.x) + Math.PI / 2
}
