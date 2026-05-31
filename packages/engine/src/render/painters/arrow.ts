import type { ArrowElement, Arrowhead, Element, Point } from '../../model/types.js'
import { polylineMidpoint } from '../../text/arrowLabel.js'
import { dashPattern } from './dash.js'
import { paintArrowLabel } from './text.js'

const ARROWHEAD_LENGTH = 12
const ARROWHEAD_WIDTH = 9
const DOT_RADIUS = 4
const BAR_HALF = 7

export function paintArrow(ctx: CanvasRenderingContext2D, element: Element): void {
  const arrow = element as ArrowElement
  const points = arrow.points
  if (points.length < 2) return
  const { style } = arrow

  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = style.stroke
  ctx.fillStyle = style.stroke
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.setLineDash(dashPattern(style.strokeStyle))
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.stroke()

  ctx.setLineDash([])
  const first = points[0]
  const second = points[1]
  const last = points[points.length - 1]
  const beforeLast = points[points.length - 2]
  if (first && second) paintHead(ctx, arrow.startArrowhead, first, second, style.strokeWidth)
  if (last && beforeLast) paintHead(ctx, arrow.endArrowhead, last, beforeLast, style.strokeWidth)
  ctx.restore()

  paintArrowLabel(ctx, arrow, polylineMidpoint(points))
}

function paintHead(
  ctx: CanvasRenderingContext2D,
  head: Arrowhead,
  tip: Point,
  from: Point,
  strokeWidth: number,
): void {
  if (head === 'none') return
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  ctx.save()
  ctx.translate(tip.x, tip.y)
  ctx.rotate(angle)
  const scale = 1 + strokeWidth / 6

  if (head === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-ARROWHEAD_LENGTH * scale, -ARROWHEAD_WIDTH * scale * 0.5)
    ctx.lineTo(-ARROWHEAD_LENGTH * scale, ARROWHEAD_WIDTH * scale * 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    return
  }
  if (head === 'dot') {
    ctx.beginPath()
    ctx.arc(0, 0, DOT_RADIUS * scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  ctx.lineWidth = strokeWidth
  ctx.beginPath()
  ctx.moveTo(0, -BAR_HALF * scale)
  ctx.lineTo(0, BAR_HALF * scale)
  ctx.stroke()
  ctx.restore()
}
