import type { Element } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shapeOutline.js'
import { dashPattern } from './dash.js'
import { strokeOutline } from './sketch.js'
import { paintLabel } from './text.js'

const SHADOW_COLOR = 'rgba(15, 23, 42, 0.18)'
const SHADOW_BLUR = 12
const SHADOW_OFFSET_Y = 6

export function paintSticky(ctx: CanvasRenderingContext2D, element: Element): void {
  const outline = getOutline('roundRect', element, element.style.roundness)
  if (!outline) return

  const { style } = element
  ctx.save()
  ctx.globalAlpha = style.opacity

  ctx.beginPath()
  traceOutline(ctx, outline)
  ctx.shadowColor = SHADOW_COLOR
  ctx.shadowBlur = SHADOW_BLUR
  ctx.shadowOffsetY = SHADOW_OFFSET_Y
  ctx.fillStyle = style.fill
  ctx.fill()
  ctx.shadowColor = 'transparent'

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
