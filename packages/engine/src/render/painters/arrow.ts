import type { Drawable } from 'roughjs/bin/core.js'
import type { ArrowElement, Arrowhead, Element, Point } from '../../model/types.js'
import { arrowRoute } from '../../connectors/resolve.js'
import { polylineMidpoint } from '../../text/arrow-label.js'
import type { DrawTarget } from '../draw-target.js'
import { arrowCache, type ArrowDrawables, elementColors } from '../draw-cache.js'
import { paintDrawable } from '../rough.js'
import { dashPattern } from './dash.js'
import { isSloppy, sloppyPathDataDrawable, sloppyPolygonDrawable, sloppyPolylineDrawable } from './sketch.js'
import { paintArrowLabel } from './text.js'

const ARROWHEAD_LENGTH = 12
const ARROWHEAD_WIDTH = 9
const DOT_RADIUS = 4
const BAR_HALF = 7
const BEND_RADIUS = 18

export function paintArrow(ctx: DrawTarget, element: Element, dark: boolean): void {
  const arrow = element as ArrowElement
  const points = arrowRoute(arrow)
  if (points.length < 2) return
  const { style } = arrow
  const stroke = elementColors(arrow, dark).stroke
  const scale = headScale(style.strokeWidth)
  const startTrim = headTrim(arrow.startArrowhead, scale)
  const endTrim = headTrim(arrow.endArrowhead, scale)
  const shaftPoints = trimmedShaftPoints(points, startTrim, endTrim)
  const origin = isSloppy(arrow) ? pointsMin(shaftPoints) : null
  const drawables = origin ? arrowDrawables(arrow, shaftPoints, origin, scale) : null

  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = stroke
  ctx.fillStyle = stroke
  ctx.lineJoin = style.roundness > 0 ? 'round' : 'miter'
  ctx.lineCap = style.roundness > 0 ? 'round' : 'butt'

  ctx.setLineDash(dashPattern(style.strokeStyle))
  if (drawables && origin) {
    ctx.save()
    ctx.translate(origin.x, origin.y)
    if (drawables.shaft) paintDrawable(ctx, drawables.shaft)
    ctx.restore()
  } else {
    ctx.beginPath()
    traceRoundedShaft(ctx, shaftPoints)
    ctx.stroke()
  }

  ctx.setLineDash([])
  const first = points[0]
  const second = points[1]
  const last = points[points.length - 1]
  const beforeLast = points[points.length - 2]
  if (first && second) paintHead(ctx, arrow.startArrowhead, first, second, arrow, drawables?.startHead ?? null)
  if (last && beforeLast) paintHead(ctx, arrow.endArrowhead, last, beforeLast, arrow, drawables?.endHead ?? null)
  ctx.restore()

  paintArrowLabel(ctx, arrow, polylineMidpoint(points), dark)
}

function arrowDrawables(
  arrow: ArrowElement,
  shaftPoints: Point[],
  origin: Point,
  scale: number,
): ArrowDrawables {
  const local = shaftPoints.map((point) => ({ x: point.x - origin.x, y: point.y - origin.y }))
  const shaftData = roundedShaftPathData(local)
  const { style } = arrow
  const key = `${shaftData}|${style.roundness}|${style.sloppiness}|${scale}|${arrow.startArrowhead}|${arrow.endArrowhead}`
  return arrowCache.get(arrow.id, key, () => ({
    shaft: sloppyPathDataDrawable(shaftData, arrow),
    startHead: headDrawable(arrow.startArrowhead, scale, arrow, 1),
    endHead: headDrawable(arrow.endArrowhead, scale, arrow, 2),
  }))
}

function headDrawable(
  head: Arrowhead,
  scale: number,
  arrow: ArrowElement,
  seedOffset: number,
): Drawable | null {
  if (head === 'triangle') return sloppyPolygonDrawable(triangleVertices(scale), arrow, seedOffset)
  if (head === 'bar') return sloppyPolylineDrawable(barPoints(scale), arrow)
  return null
}

function triangleVertices(scale: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: -ARROWHEAD_LENGTH * scale, y: -ARROWHEAD_WIDTH * scale * 0.5 },
    { x: -ARROWHEAD_LENGTH * scale, y: ARROWHEAD_WIDTH * scale * 0.5 },
  ]
}

function barPoints(scale: number): Point[] {
  return [
    { x: 0, y: -BAR_HALF * scale },
    { x: 0, y: BAR_HALF * scale },
  ]
}

function pointsMin(points: Point[]): Point {
  let x = Infinity
  let y = Infinity
  for (const point of points) {
    if (point.x < x) x = point.x
    if (point.y < y) y = point.y
  }
  return { x, y }
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

export function roundedShaftPathData(points: Point[]): string {
  const first = points[0]
  if (!first) return ''
  const commands = [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`]
  forEachRoundedShaftSegment(
    points,
    (point) => commands.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`),
    (control, point) =>
      commands.push(
        `Q ${formatNumber(control.x)} ${formatNumber(control.y)} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
      ),
  )
  return commands.join(' ')
}

function traceRoundedShaft(ctx: DrawTarget, points: Point[]): void {
  const first = points[0]
  if (!first) return
  ctx.moveTo(first.x, first.y)
  forEachRoundedShaftSegment(
    points,
    (point) => ctx.lineTo(point.x, point.y),
    (control, point) => ctx.quadraticCurveTo(control.x, control.y, point.x, point.y),
  )
}

function forEachRoundedShaftSegment(
  points: Point[],
  lineTo: (point: Point) => void,
  curveTo: (control: Point, point: Point) => void,
): void {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!
    const current = points[index]!
    const next = points[index + 1]
    if (!next) {
      lineTo(current)
      continue
    }
    const radius = bendRadius(previous, current, next)
    if (radius === 0) {
      lineTo(current)
      continue
    }
    lineTo(pointToward(current, previous, radius))
    curveTo(current, pointToward(current, next, radius))
  }
}

function bendRadius(previous: Point, current: Point, next: Point): number {
  if (isCollinear(previous, current, next)) return 0
  return Math.min(BEND_RADIUS, distance(previous, current) / 2, distance(current, next) / 2)
}

function pointToward(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length <= distance || length === 0) return { ...to }
  const ratio = distance / length
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function isCollinear(a: Point, b: Point, c: Point): boolean {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return Math.abs(cross) < 0.001
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`
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
  ctx: DrawTarget,
  head: Arrowhead,
  tip: Point,
  from: Point,
  arrow: ArrowElement,
  sloppyDrawable: Drawable | null,
): void {
  if (head === 'none') return
  const { strokeWidth, roundness } = arrow.style
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  ctx.save()
  ctx.translate(tip.x, tip.y)
  ctx.rotate(angle)
  const scale = headScale(strokeWidth)

  if (head === 'triangle') {
    if (sloppyDrawable) {
      paintDrawable(ctx, sloppyDrawable)
      ctx.restore()
      return
    }
    const vertices = triangleVertices(scale)
    ctx.beginPath()
    vertices.forEach((point, index) =>
      index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y),
    )
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
  if (sloppyDrawable) {
    paintDrawable(ctx, sloppyDrawable)
    ctx.restore()
    return
  }
  const bar = barPoints(scale)
  ctx.lineWidth = strokeWidth
  ctx.beginPath()
  ctx.moveTo(bar[0]!.x, bar[0]!.y)
  ctx.lineTo(bar[1]!.x, bar[1]!.y)
  ctx.stroke()
  ctx.restore()
}
