import { getStroke } from 'perfect-freehand'
import type { Element, FreedrawElement } from '../../model/types.js'
import { elementColors, strokeCache } from '../draw-cache.js'

const STROKE_SIZE_FACTOR = 4
const STROKE_SMOOTHING = 0.5
const STROKE_THINNING = 0.6
const STROKE_STREAMLINE = 0.5

export function freedrawSize(strokeWidth: number): number {
  return Math.max(1, strokeWidth) * STROKE_SIZE_FACTOR
}

export function paintFreedraw(ctx: CanvasRenderingContext2D, element: Element, dark: boolean): void {
  const freedraw = element as FreedrawElement
  const { points, style } = freedraw
  if (points.length === 0) return

  ctx.save()
  ctx.globalAlpha = style.opacity

  const size = freedrawSize(style.strokeWidth)
  const key = `${size}|${points.length}|${round(freedraw.width)}|${round(freedraw.height)}`
  const outline = strokeCache.get(freedraw.id, key, () =>
    getStroke(
      points.map((p) => [p.x - freedraw.x, p.y - freedraw.y]),
      {
        size,
        smoothing: STROKE_SMOOTHING,
        thinning: STROKE_THINNING,
        streamline: STROKE_STREAMLINE,
      },
    ),
  )
  if (outline.length === 0) {
    ctx.restore()
    return
  }

  ctx.translate(freedraw.x, freedraw.y)
  ctx.fillStyle = elementColors(freedraw, dark).stroke
  ctx.beginPath()
  outline.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x!, y!)
    else ctx.lineTo(x!, y!)
  })
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
