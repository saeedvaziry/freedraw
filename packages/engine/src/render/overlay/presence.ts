import type { Camera } from '../../geometry/camera.js'
import type { SelectionFrame } from '../../geometry/handles.js'
import type { Point } from '../../model/types.js'
import { PRESENCE_COLORS, type PresenceColors } from '../color-config.js'

export interface PresenceCursor {
  id: string
  point: Point
  color: string
  label?: string
}

export interface PresenceHalo {
  id: string
  frame: SelectionFrame
  color: string
}

export interface PresenceOverlay {
  cursors: PresenceCursor[]
  halos: PresenceHalo[]
}

const CURSOR_LABEL_FONT = '12px system-ui, -apple-system, sans-serif'
const CURSOR_LABEL_HEIGHT = 18
const CURSOR_LABEL_PADDING = 6
const HALO_LINE_WIDTH = 1.5

export function paintPresence(
  ctx: CanvasRenderingContext2D,
  presence: PresenceOverlay,
  camera: Camera,
  colors: PresenceColors = PRESENCE_COLORS,
): void {
  for (const halo of presence.halos) paintHalo(ctx, halo, camera)
  for (const cursor of presence.cursors) paintCursor(ctx, cursor, camera, colors)
}

function paintHalo(ctx: CanvasRenderingContext2D, halo: PresenceHalo, camera: Camera): void {
  const corners = frameCornersScreen(halo.frame, camera)
  ctx.save()
  ctx.strokeStyle = halo.color
  ctx.lineWidth = HALO_LINE_WIDTH
  ctx.setLineDash([])
  ctx.beginPath()
  corners.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function paintCursor(
  ctx: CanvasRenderingContext2D,
  cursor: PresenceCursor,
  camera: Camera,
  colors: PresenceColors,
): void {
  const screen = camera.worldToScreen(cursor.point)
  ctx.save()
  ctx.translate(screen.x, screen.y)
  ctx.fillStyle = cursor.color
  ctx.strokeStyle = colors.cursorOutline
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 17)
  ctx.lineTo(4.6, 12.7)
  ctx.lineTo(7.4, 18.5)
  ctx.lineTo(9.9, 17.4)
  ctx.lineTo(7.1, 11.7)
  ctx.lineTo(13, 11.7)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  if (cursor.label) paintCursorLabel(ctx, cursor, colors)
  ctx.restore()
}

function paintCursorLabel(
  ctx: CanvasRenderingContext2D,
  cursor: PresenceCursor,
  colors: PresenceColors,
): void {
  const label = cursor.label ?? ''
  ctx.font = CURSOR_LABEL_FONT
  const textWidth = ctx.measureText(label).width
  const width = textWidth + CURSOR_LABEL_PADDING * 2
  const x = 14
  const y = 12
  ctx.fillStyle = cursor.color
  roundRectPath(ctx, x, y, width, CURSOR_LABEL_HEIGHT, 4)
  ctx.fill()
  ctx.fillStyle = colors.cursorLabelText
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(label, x + CURSOR_LABEL_PADDING, y + CURSOR_LABEL_HEIGHT / 2)
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
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
