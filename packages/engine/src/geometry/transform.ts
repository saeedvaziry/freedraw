import type { Element, Point } from '../model/types.js'
import { GRID_SIZE } from './grid.js'
import type { Rect } from './rect.js'
import { rotatePoint } from './rotate.js'
import type { ResizeHandleId, SelectionFrame } from './handles.js'

export interface ResizeResult {
  id: string
  patch: Partial<Element>
}

const MIN_DIMENSION = GRID_SIZE

function toFrameLocal(point: Point, frame: SelectionFrame): Point {
  return rotatePoint(point, frame.center, -frame.rotation)
}

function toFrameWorld(point: Point, frame: SelectionFrame): Point {
  return rotatePoint(point, frame.center, frame.rotation)
}

function localOrigin(element: Element, frame: SelectionFrame): Point {
  if (!frame.rotation) return { x: element.x, y: element.y }
  const center = toFrameLocal(
    { x: element.x + element.width / 2, y: element.y + element.height / 2 },
    frame,
  )
  return { x: center.x - element.width / 2, y: center.y - element.height / 2 }
}

function worldOrigin(origin: Point, width: number, height: number, frame: SelectionFrame): Point {
  if (!frame.rotation) return origin
  const center = toFrameWorld({ x: origin.x + width / 2, y: origin.y + height / 2 }, frame)
  return { x: center.x - width / 2, y: center.y - height / 2 }
}

export function resizedBounds(
  frame: SelectionFrame,
  handle: ResizeHandleId,
  pointer: Point,
): Rect {
  const local = toFrameLocal(pointer, frame)
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
    const origin = localOrigin(element, frame)
    const width = Math.max(MIN_DIMENSION, element.width * sx)
    const height = Math.max(MIN_DIMENSION, element.height * sy)
    const placed = worldOrigin(
      {
        x: next.x + (origin.x - frame.bounds.x) * sx,
        y: next.y + (origin.y - frame.bounds.y) * sy,
      },
      width,
      height,
      frame,
    )
    const x = placed.x
    const y = placed.y
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
