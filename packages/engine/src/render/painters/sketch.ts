import type { Element, Point } from '../../model/types.js'
import { getOutline, type Outline, traceOutline } from '../../geometry/shape-outline.js'
import {
  hashSeed,
  paintDrawable,
  roughOutlineDrawable,
  strokeRoughPath,
  strokeRoughPolygon,
  strokeRoughPolyline,
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

export function strokeSloppyPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  element: Element,
): void {
  strokeRoughPolyline(ctx, points, element.style.sloppiness, hashSeed(element.id))
}

export function strokeSloppyPathData(
  ctx: CanvasRenderingContext2D,
  d: string,
  element: Element,
): void {
  strokeRoughPath(ctx, d, element.style.sloppiness, hashSeed(element.id))
}

export function strokeSloppyPolygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  element: Element,
  seedOffset: number,
): void {
  strokeRoughPolygon(ctx, points, element.style.sloppiness, hashSeed(element.id) + seedOffset)
}
