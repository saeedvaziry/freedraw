import type { ArrowElement, Arrowhead, Element, Point } from '../../model/types.js'
import { arrowRoute } from '../../connectors/resolve.js'
import { polylineMidpoint } from '../../text/arrowLabel.js'
import { dashPattern } from './dash.js'
import { paintArrowLabel } from './text.js'

const ARROWHEAD_LENGTH = 12
const ARROWHEAD_WIDTH = 9
const DOT_RADIUS = 4
const BAR_HALF = 7

export function paintArrow(ctx: CanvasRenderingContext2D, element: Element): void {
  const arrow = element as ArrowElement
  const points = arrowRoute(arrow)
  if (points.length < 2) return
  const { style } = arrow
  const scale = headScale(style.strokeWidth)
  const shaftPoints = trimmedShaftPoints(
    points,
    headTrim(arrow.startArrowhead, scale),
    headTrim(arrow.endArrowhead, scale),
  )

  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = style.stroke
  ctx.fillStyle = style.stroke
  ctx.lineJoin = style.roundness > 0 ? 'round' : 'miter'
  ctx.lineCap = style.roundness > 0 ? 'round' : 'butt'

  ctx.beginPath()
  ctx.setLineDash(dashPattern(style.strokeStyle))
  shaftPoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.stroke()

  ctx.setLineDash([])
  const first = points[0]
  const second = points[1]
  const last = points[points.length - 1]
  const beforeLast = points[points.length - 2]
  if (first && second) paintHead(ctx, arrow.startArrowhead, first, second, style.strokeWidth, style.roundness)
  if (last && beforeLast) paintHead(ctx, arrow.endArrowhead, last, beforeLast, style.strokeWidth, style.roundness)
  ctx.restore()

  paintArrowLabel(ctx, arrow, polylineMidpoint(points))
}

export function trimmedShaftPoints(points: Point[], startTrim: number, endTrim: number): Point[] {
  if (points.length < 2) return points
  const next = points.map((point) => ({ ...point }))
  if (startTrim > 0) next[0] = pointToward(next[0]!, next[1]!, startTrim)
  if (endTrim > 0) {
    const lastIndex = next.length - 1
    next[lastIndex] = pointToward(next[lastIndex]!, next[lastIndex - 1]!, endTrim)
  }
  return next
}

function pointToward(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= distance || length === 0) return { ...to }
  const ratio = distance / length
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

function headScale(strokeWidth: number): number {
  return 1 + strokeWidth / 6
}

function headTrim(head: Arrowhead, scale: number): number {
  if (head === 'triangle') return ARROWHEAD_LENGTH * scale
  if (head === 'dot') return DOT_RADIUS * scale
  return 0
}

function paintHead(
  ctx: CanvasRenderingContext2D,
  head: Arrowhead,
  tip: Point,
  from: Point,
  strokeWidth: number,
  roundness: number,
): void {
  if (head === 'none') return
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  ctx.save()
  ctx.translate(tip.x, tip.y)
  ctx.rotate(angle)
  const scale = headScale(strokeWidth)

  if (head === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(-ARROWHEAD_LENGTH * scale, -ARROWHEAD_WIDTH * scale * 0.5)
    ctx.lineTo(-ARROWHEAD_LENGTH * scale, ARROWHEAD_WIDTH * scale * 0.5)
    ctx.closePath()
    ctx.fill()
    if (roundness > 0) {
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.min(roundness, strokeWidth + 3)
      ctx.stroke()
    }
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
