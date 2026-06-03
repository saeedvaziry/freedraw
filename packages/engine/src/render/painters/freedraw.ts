import { getStroke } from 'perfect-freehand'
import type { Element, FreedrawElement, Point } from '../../model/types.js'

const STROKE_SIZE_FACTOR = 4
const STROKE_SMOOTHING = 0.5
const STROKE_THINNING = 0.6
const STROKE_STREAMLINE = 0.5

export function freedrawSize(strokeWidth: number): number {
  return Math.max(1, strokeWidth) * STROKE_SIZE_FACTOR
}

export function paintFreedraw(ctx: CanvasRenderingContext2D, element: Element): void {
  const freedraw = element as FreedrawElement
  const { points, style } = freedraw
  if (points.length === 0) return

  ctx.save()
  ctx.globalAlpha = style.opacity

  const outline = getStroke(points.map(toPair), {
    size: freedrawSize(style.strokeWidth),
    smoothing: STROKE_SMOOTHING,
    thinning: STROKE_THINNING,
    streamline: STROKE_STREAMLINE,
  })
  if (outline.length === 0) {
    ctx.restore()
    return
  }

  ctx.fillStyle = style.stroke
  ctx.beginPath()
  outline.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x!, y!)
    else ctx.lineTo(x!, y!)
  })
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function toPair(point: Point): [number, number] {
  return [point.x, point.y]
}
