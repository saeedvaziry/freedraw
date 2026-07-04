import type { Element } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shape-outline.js'
import { isInvertingContext, rawContext } from '../invert.js'
import { dashPattern } from './dash.js'
import { strokeOutline } from './sketch.js'
import { paintLabel } from './text.js'

const BASE_SHADOW_LIGHT = 'rgba(15, 23, 42, 0.26)'
const BASE_SHADOW_DARK = 'rgba(0, 0, 0, 0.55)'
const BASE_BLUR = 10
const BASE_OFFSET_Y = 7

export function paintSticky(proxyCtx: CanvasRenderingContext2D, element: Element): void {
  const outline = getOutline('roundRect', element, element.style.roundness)
  if (!outline) return

  const dark = isInvertingContext(proxyCtx)
  const ctx = rawContext(proxyCtx)
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
    strokeOutline(ctx, outline, element)
  }
  ctx.restore()

  paintLabel(ctx, element)
}

function paintCurledShadow(
  ctx: CanvasRenderingContext2D,
  outline: ReturnType<typeof getOutline>,
  dark: boolean,
): void {
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.shadowColor = dark ? BASE_SHADOW_DARK : BASE_SHADOW_LIGHT
  ctx.shadowBlur = BASE_BLUR
  ctx.shadowOffsetY = BASE_OFFSET_Y
  ctx.beginPath()
  if (outline) traceOutline(ctx, outline)
  ctx.fill()
  ctx.restore()
}
