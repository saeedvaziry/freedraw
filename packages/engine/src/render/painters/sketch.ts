import type { Element, Point } from '../../model/types.js'
import { type Outline, traceOutline } from '../../geometry/shapeOutline.js'
import { hashSeed, strokeRoughOutline, strokeRoughPolygon, strokeRoughPolyline } from '../rough.js'

export function isSloppy(element: Element): boolean {
  return element.style.sloppiness > 0
}

export function strokeOutline(
  ctx: CanvasRenderingContext2D,
  outline: Outline,
  element: Element,
): void {
  if (!isSloppy(element)) {
    ctx.beginPath()
    traceOutline(ctx, outline)
    ctx.stroke()
    return
  }
  strokeRoughOutline(ctx, outline, element.style.sloppiness, hashSeed(element.id))
}

export function strokeSloppyPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  element: Element,
): void {
  strokeRoughPolyline(ctx, points, element.style.sloppiness, hashSeed(element.id))
}

export function strokeSloppyPolygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  element: Element,
  seedOffset: number,
): void {
  strokeRoughPolygon(ctx, points, element.style.sloppiness, hashSeed(element.id) + seedOffset)
}
