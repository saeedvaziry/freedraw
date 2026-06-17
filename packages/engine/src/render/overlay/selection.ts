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

const ACCENT = '#4f6bff'
const HANDLE_FILL = '#ffffff'

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

export function paintMarquee(ctx: CanvasRenderingContext2D, marquee: Rect, camera: Camera): void {
  const screen = marqueeScreenRect(marquee, camera)
  ctx.save()
  ctx.strokeStyle = ACCENT
  ctx.fillStyle = 'rgba(79, 107, 255, 0.1)'
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.fillRect(screen.x, screen.y, screen.width, screen.height)
  ctx.strokeRect(screen.x, screen.y, screen.width, screen.height)
  ctx.restore()
}

export function paintHover(ctx: CanvasRenderingContext2D, element: Element, camera: Camera): void {
  const outlineType = element.type === 'sticky' || element.type === 'image' ? 'roundRect' : element.type
  const outline = getOutline(outlineType, elementBounds(element), element.style.roundness)
  ctx.save()
  ctx.strokeStyle = ACCENT
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
}

export function paintSelection(
  ctx: CanvasRenderingContext2D,
  frame: SelectionFrame,
  camera: Camera,
): void {
  const corners = frameCornersScreen(frame, camera)
  ctx.save()
  ctx.strokeStyle = ACCENT
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

  ctx.fillStyle = HANDLE_FILL
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
