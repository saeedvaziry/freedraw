import type { Element } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shape-outline.js'
import { dashPattern } from './dash.js'
import { strokeOutline } from './sketch.js'
import { paintLabel } from './text.js'

export function paintShape(ctx: CanvasRenderingContext2D, element: Element): void {
  const outline = getOutline(element.type, element, element.style.roundness)
  if (!outline) return

  const { style } = element
  ctx.save()
  ctx.globalAlpha = style.opacity

  if (style.fill !== 'transparent') {
    ctx.beginPath()
    traceOutline(ctx, outline)
    ctx.fillStyle = style.fill
    ctx.fill()
  }

  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = style.stroke
  ctx.lineJoin = 'round'
  ctx.setLineDash(dashPattern(style.strokeStyle))
  strokeOutline(ctx, outline, element)
  ctx.restore()

  paintLabel(ctx, element)
}
