import type { Element } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shapeOutline.js'
import { dashPattern } from './dash.js'
import { paintLabel } from './text.js'

export function paintShape(ctx: CanvasRenderingContext2D, element: Element): void {
  const outline = getOutline(element.type, element, element.style.roundness)
  if (!outline) return

  const { style } = element
  ctx.save()
  ctx.globalAlpha = style.opacity

  ctx.beginPath()
  traceOutline(ctx, outline)

  if (style.fill !== 'transparent') {
    ctx.fillStyle = style.fill
    ctx.fill()
  }

  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = style.stroke
  ctx.lineJoin = 'round'
  ctx.setLineDash(dashPattern(style.strokeStyle))
  ctx.stroke()
  ctx.restore()

  paintLabel(ctx, element)
}
