import type { Camera } from '../../geometry/camera.js'
import {
  HANDLE_SIZE,
  ROTATE_HANDLE_RADIUS,
  resizeHandlesScreen,
  rotateHandleScreen,
  type SelectionFrame,
} from '../../geometry/handles.js'
import { getOutline, traceOutline } from '../../geometry/shape-outline.js'
import { elementBounds, elementCenter } from '../../geometry/hit-test.js'
import type { Element, Point } from '../../model/types.js'
import type { Rect } from '../../geometry/rect.js'
import type { OverlayColors } from '../color-config.js'

const LOCK_BADGE_RADIUS = 9

export function marqueeScreenRect(marquee: Rect, camera: Camera): Rect {
  const a = camera.worldToScreen({ x: marquee.x, y: marquee.y })
  const b = camera.worldToScreen({ x: marquee.x + marquee.width, y: marquee.y + marquee.height })
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function paintMarquee(
  ctx: CanvasRenderingContext2D,
  marquee: Rect,
  camera: Camera,
  colors: OverlayColors,
): void {
  const screen = marqueeScreenRect(marquee, camera)
  ctx.save()
  ctx.strokeStyle = colors.accent
  ctx.fillStyle = colors.accentSoft
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.fillRect(screen.x, screen.y, screen.width, screen.height)
  ctx.strokeRect(screen.x, screen.y, screen.width, screen.height)
  ctx.restore()
}

export function paintHover(
  ctx: CanvasRenderingContext2D,
  element: Element,
  camera: Camera,
  colors: OverlayColors,
): void {
  const outlineType = element.type === 'sticky' || element.type === 'image' ? 'roundRect' : element.type
  const outline = getOutline(outlineType, elementBounds(element), element.style.roundness)
  ctx.save()
  ctx.strokeStyle = colors.accent
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  const center = elementCenter(element)
  const screenCenter = camera.worldToScreen(center)
  ctx.translate(screenCenter.x, screenCenter.y)
  ctx.rotate(element.rotation)
  ctx.scale(camera.zoom, camera.zoom)
  ctx.translate(-center.x, -center.y)
  ctx.beginPath()
  if (outline) traceOutline(ctx, outline)
  else traceRect(ctx, elementBounds(element))
  ctx.restore()
  ctx.stroke()
  if (element.locked) paintLockBadge(ctx, element, camera, colors)
}

function paintLockBadge(
  ctx: CanvasRenderingContext2D,
  element: Element,
  camera: Camera,
  colors: OverlayColors,
): void {
  const center = elementCenter(element)
  const cos = Math.cos(element.rotation)
  const sin = Math.sin(element.rotation)
  const dx = element.x - center.x
  const dy = element.y - center.y
  const corner = camera.worldToScreen({
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  })
  drawLockBadge(ctx, corner, colors)
}

function drawLockBadge(ctx: CanvasRenderingContext2D, position: Point, colors: OverlayColors): void {
  const { x, y } = position
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, LOCK_BADGE_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = colors.accent
  ctx.fill()
  ctx.strokeStyle = colors.handle
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.strokeStyle = colors.handle
  ctx.fillStyle = colors.handle
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(x, y - 1.4, 2.4, Math.PI, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.rect(x - 3.4, y - 1.4, 6.8, 5.4)
  ctx.fill()
  ctx.restore()
}

export function paintSelection(
  ctx: CanvasRenderingContext2D,
  frame: SelectionFrame,
  camera: Camera,
  colors: OverlayColors,
): void {
  const corners = frameCornersScreen(frame, camera)
  ctx.save()
  ctx.strokeStyle = colors.accent
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  ctx.beginPath()
  corners.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.closePath()
  ctx.stroke()

  const rotate = rotateHandleScreen(frame, camera)
  const topCenter = midpoint(corners[0], corners[1])
  ctx.beginPath()
  ctx.moveTo(topCenter.x, topCenter.y)
  ctx.lineTo(rotate.position.x, rotate.position.y)
  ctx.stroke()

  ctx.fillStyle = colors.handle
  for (const handle of resizeHandlesScreen(frame, camera)) {
    drawHandleSquare(ctx, handle.position)
  }
  drawHandleCircle(ctx, rotate.position)
  ctx.restore()
}

function frameCornersScreen(frame: SelectionFrame, camera: Camera): Point[] {
  const { bounds, center, rotation } = frame
  const local: Point[] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return local.map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y
    return camera.worldToScreen({
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    })
  })
}

function drawHandleSquare(ctx: CanvasRenderingContext2D, position: Point): void {
  const half = HANDLE_SIZE / 2
  ctx.beginPath()
  ctx.rect(position.x - half, position.y - half, HANDLE_SIZE, HANDLE_SIZE)
  ctx.fill()
  ctx.stroke()
}

function drawHandleCircle(ctx: CanvasRenderingContext2D, position: Point): void {
  ctx.beginPath()
  ctx.arc(position.x, position.y, ROTATE_HANDLE_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function midpoint(a: Point | undefined, b: Point | undefined): Point {
  if (!a || !b) return { x: 0, y: 0 }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function traceRect(ctx: CanvasRenderingContext2D, bounds: Rect): void {
  ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height)
}
