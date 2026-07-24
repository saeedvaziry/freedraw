import type { Element } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shape-outline.js'
import type { DrawTarget } from '../draw-target.js'
import { dashPattern } from './dash.js'
import { strokeOutline } from './sketch.js'
import { paintLabel } from './text.js'

interface CanvasPoint {
  x: number
  y: number
}

interface CanvasTransform {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export const BASE_SHADOW_LIGHT = 'rgba(15, 23, 42, 0.26)'
export const BASE_SHADOW_DARK = 'rgba(0, 0, 0, 0.55)'
const BASE_BLUR = 10
const BASE_OFFSET_Y = 7

export function paintSticky(ctx: DrawTarget, element: Element, dark: boolean): void {
  const outline = getOutline('roundRect', element, element.style.roundness)
  if (!outline) return

  const { style } = element
  ctx.save()
  ctx.globalAlpha = style.opacity

  paintCurledShadow(ctx, outline, dark)

  ctx.beginPath()
  traceOutline(ctx, outline)
  ctx.fillStyle = style.fill
  ctx.fill()

  if (style.strokeWidth > 0) {
    ctx.lineWidth = style.strokeWidth
    ctx.strokeStyle = style.stroke
    ctx.lineJoin = 'round'
    ctx.setLineDash(dashPattern(style.strokeStyle))
    strokeOutline(ctx, outline, element, 'roundRect')
  }
  ctx.restore()

  paintLabel(ctx, element, false)
}

function paintCurledShadow(
  ctx: DrawTarget,
  outline: ReturnType<typeof getOutline>,
  dark: boolean,
): void {
  ctx.save()
  ctx.beginPath()
  traceCanvasBounds(ctx)
  if (outline) traceOutline(ctx, outline)
  ctx.clip('evenodd')

  ctx.fillStyle = '#000'
  ctx.shadowColor = dark ? BASE_SHADOW_DARK : BASE_SHADOW_LIGHT
  ctx.shadowBlur = BASE_BLUR
  ctx.shadowOffsetY = BASE_OFFSET_Y
  ctx.beginPath()
  if (outline) traceOutline(ctx, outline)
  ctx.fill()
  ctx.restore()
}

function traceCanvasBounds(ctx: DrawTarget): void {
  const { width, height } = ctx.canvas
  const transform = ctx.getTransform()
  const topLeft = transformCanvasPoint(transform, 0, 0)
  const topRight = transformCanvasPoint(transform, width, 0)
  const bottomRight = transformCanvasPoint(transform, width, height)
  const bottomLeft = transformCanvasPoint(transform, 0, height)

  ctx.moveTo(topLeft.x, topLeft.y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(bottomLeft.x, bottomLeft.y)
  ctx.closePath()
}

function transformCanvasPoint(transform: CanvasTransform, x: number, y: number): CanvasPoint {
  const determinant = transform.a * transform.d - transform.b * transform.c
  if (determinant === 0) return { x, y }

  return {
    x: (transform.d * (x - transform.e) - transform.c * (y - transform.f)) / determinant,
    y: (-transform.b * (x - transform.e) + transform.a * (y - transform.f)) / determinant,
  }
}
