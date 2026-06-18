import type { Camera } from './camera.js'
import type { Point } from '../model/types.js'
import type { Rect } from './rect.js'

export type ResizeHandleId =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'

export type HandleId = ResizeHandleId | 'rotate'

export const RESIZE_HANDLE_IDS: ResizeHandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const HANDLE_SIZE = 8
export const HANDLE_HIT_RADIUS = 8
export const ROTATE_HANDLE_RADIUS = 6
export const ROTATE_HANDLE_OFFSET = 24

export interface SelectionFrame {
  bounds: Rect
  rotation: number
  center: Point
}

export interface Handle {
  id: HandleId
  position: Point
}

function localHandlePoints(bounds: Rect): Record<ResizeHandleId, Point> {
  const { x, y, width, height } = bounds
  const cx = x + width / 2
  const cy = y + height / 2
  return {
    nw: { x, y },
    n: { x: cx, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: cy },
    se: { x: x + width, y: y + height },
    s: { x: cx, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: cy },
  }
}

function rotatePoint(point: Point, center: Point, rotation: number): Point {
  if (!rotation) return point
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function resizeHandlesScreen(frame: SelectionFrame, camera: Camera): Handle[] {
  const local = localHandlePoints(frame.bounds)
  return RESIZE_HANDLE_IDS.map((id) => ({
    id,
    position: camera.worldToScreen(rotatePoint(local[id], frame.center, frame.rotation)),
  }))
}

export function rotateHandleScreen(frame: SelectionFrame, camera: Camera): Handle {
  const local: Point = { x: frame.bounds.x + frame.bounds.width / 2, y: frame.bounds.y }
  const top = camera.worldToScreen(rotatePoint(local, frame.center, frame.rotation))
  const direction = frame.rotation - Math.PI / 2
  return {
    id: 'rotate',
    position: {
      x: top.x + Math.cos(direction) * ROTATE_HANDLE_OFFSET,
      y: top.y + Math.sin(direction) * ROTATE_HANDLE_OFFSET,
    },
  }
}

export function handleAtScreen(
  screen: Point,
  frame: SelectionFrame,
  camera: Camera,
): HandleId | null {
  const rotate = rotateHandleScreen(frame, camera)
  if (distance(screen, rotate.position) <= HANDLE_HIT_RADIUS) return 'rotate'
  for (const handle of resizeHandlesScreen(frame, camera)) {
    if (distance(screen, handle.position) <= HANDLE_HIT_RADIUS) return handle.id
  }
  return null
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
