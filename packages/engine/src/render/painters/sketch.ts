import type { Drawable } from 'roughjs/bin/core.js'
import type { Element, Point } from '../../model/types.js'
import { getOutline, type Outline, traceOutline } from '../../geometry/shape-outline.js'
import {
  hashSeed,
  paintDrawable,
  roughOutlineDrawable,
  roughPathDrawable,
  roughPolygonDrawable,
  roughPolylineDrawable,
} from '../rough.js'
import { drawableCache } from '../draw-cache.js'

export function isSloppy(element: Element): boolean {
  return element.style.sloppiness > 0
}

export function strokeOutline(
  ctx: CanvasRenderingContext2D,
  outline: Outline,
  element: Element,
  outlineType: string,
): void {
  if (!isSloppy(element)) {
    ctx.beginPath()
    traceOutline(ctx, outline)
    ctx.stroke()
    return
  }
  const { roundness, sloppiness } = element.style
  const key = `${outlineType}|${round(element.width)}|${round(element.height)}|${roundness}|${sloppiness}`
  const drawable = drawableCache.get(element.id, key, () => {
    const local = getOutline(
      outlineType,
      { x: 0, y: 0, width: element.width, height: element.height },
      roundness,
    )!
    return roughOutlineDrawable(local, sloppiness, hashSeed(element.id))
  })
  ctx.save()
  ctx.translate(element.x, element.y)
  paintDrawable(ctx, drawable)
  ctx.restore()
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function sloppyPolylineDrawable(points: Point[], element: Element): Drawable | null {
  if (points.length < 2) return null
  return roughPolylineDrawable(points, element.style.sloppiness, hashSeed(element.id))
}

export function sloppyPathDataDrawable(d: string, element: Element): Drawable {
  return roughPathDrawable(d, element.style.sloppiness, hashSeed(element.id))
}

export function sloppyPolygonDrawable(
  points: Point[],
  element: Element,
  seedOffset: number,
): Drawable | null {
  if (points.length < 2) return null
  return roughPolygonDrawable(points, element.style.sloppiness, hashSeed(element.id) + seedOffset)
}
