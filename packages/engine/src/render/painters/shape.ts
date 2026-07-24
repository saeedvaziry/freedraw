import type { Element } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shape-outline.js'
import type { DrawTarget } from '../draw-target.js'
import { elementColors } from '../draw-cache.js'
import { dashPattern } from './dash.js'
import { strokeOutline } from './sketch.js'
import { paintLabel } from './text.js'

export function paintShape(ctx: DrawTarget, element: Element, dark: boolean): void {
  const outline = getOutline(element.type, element, element.style.roundness)
  if (!outline) return

  const { style } = element
  const colors = elementColors(element, dark)
  ctx.save()
  ctx.globalAlpha = style.opacity

  if (style.fill !== 'transparent') {
    ctx.beginPath()
    traceOutline(ctx, outline)
    ctx.fillStyle = colors.fill
    ctx.fill()
  }

  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = colors.stroke
  ctx.lineJoin = 'round'
  ctx.setLineDash(dashPattern(style.strokeStyle))
  strokeOutline(ctx, outline, element, element.type)
  ctx.restore()

  paintLabel(ctx, element, dark)
}
