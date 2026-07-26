import type { Point } from '@freedraw/engine'

export const TOOLBAR_GAP = 12
export const TOOLBAR_MARGIN = 8
export const ROTATE_HANDLE_CLEARANCE = 14

export interface ToolbarAnchor {
  centerX: number
  top: number
  bottom: number
}

export interface ToolbarSize {
  width: number
  height: number
}

export interface ToolbarPlacement {
  left: number
  top: number
  below: boolean
}

export function toolbarPlacement(
  anchor: ToolbarAnchor,
  size: ToolbarSize,
  viewportWidth: number,
  rotateHandle: Point | null,
): ToolbarPlacement {
  const half = size.width / 2
  const left = clamp(anchor.centerX, half + TOOLBAR_MARGIN, viewportWidth - half - TOOLBAR_MARGIN)
  const above = clearRotateHandle(anchor.top - TOOLBAR_GAP, size.height, left, half, rotateHandle, false)
  const below = above - size.height < TOOLBAR_MARGIN
  if (!below) return { left, top: above, below: false }
  return {
    left,
    top: clearRotateHandle(anchor.bottom + TOOLBAR_GAP, size.height, left, half, rotateHandle, true),
    below: true,
  }
}

function clearRotateHandle(
  top: number,
  height: number,
  left: number,
  half: number,
  handle: Point | null,
  below: boolean,
): number {
  if (!handle) return top
  const rectTop = below ? top : top - height
  const rectBottom = below ? top + height : top
  const overlapsX =
    handle.x + ROTATE_HANDLE_CLEARANCE > left - half &&
    handle.x - ROTATE_HANDLE_CLEARANCE < left + half
  const overlapsY =
    handle.y + ROTATE_HANDLE_CLEARANCE > rectTop && handle.y - ROTATE_HANDLE_CLEARANCE < rectBottom
  if (!overlapsX || !overlapsY) return top
  return below ? handle.y + ROTATE_HANDLE_CLEARANCE : handle.y - ROTATE_HANDLE_CLEARANCE
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2
  return Math.min(Math.max(value, min), max)
}
