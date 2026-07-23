import rough from 'roughjs'
import type { RoughGenerator } from 'roughjs/bin/generator.js'
import type { Drawable, Op, OpSet, Options } from 'roughjs/bin/core.js'
import type { Outline } from '../geometry/shape-outline.js'
import { outlinePathD } from '../geometry/shape-outline.js'
import type { Point } from '../model/types.js'

const MAX_ROUGHNESS = 2.5

let generator: RoughGenerator | null = null

function roughGenerator(): RoughGenerator {
  if (!generator) generator = rough.generator()
  return generator
}

export function roughnessFor(sloppiness: number): number {
  return Math.max(0, sloppiness) * MAX_ROUGHNESS
}

export function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 2 ** 31
}

function sketchOptions(sloppiness: number, seed: number): Options {
  return {
    roughness: roughnessFor(sloppiness),
    seed,
    preserveVertices: true,
    disableMultiStroke: false,
    stroke: 'transparent',
    fill: undefined,
  }
}

export function roughPathDrawable(d: string, sloppiness: number, seed: number): Drawable {
  return roughGenerator().path(d, sketchOptions(sloppiness, seed))
}

export function roughPolygonDrawable(points: Point[], sloppiness: number, seed: number): Drawable {
  return roughGenerator().polygon(points.map(toPair), sketchOptions(sloppiness, seed))
}

export function roughPolylineDrawable(points: Point[], sloppiness: number, seed: number): Drawable {
  return roughGenerator().linearPath(points.map(toPair), sketchOptions(sloppiness, seed))
}

export function roughOutlineDrawable(outline: Outline, sloppiness: number, seed: number): Drawable {
  const options = sketchOptions(sloppiness, seed)
  if (outline.kind === 'polygon') return roughGenerator().polygon(outline.points.map(toPair), options)
  if (outline.kind === 'ellipse')
    return roughGenerator().ellipse(outline.cx, outline.cy, outline.rx * 2, outline.ry * 2, options)
  return roughGenerator().path(outlinePathD(outline), options)
}

export function strokeRoughOutline(
  ctx: CanvasRenderingContext2D,
  outline: Outline,
  sloppiness: number,
  seed: number,
): void {
  paintDrawable(ctx, roughOutlineDrawable(outline, sloppiness, seed))
}

export function paintDrawable(ctx: CanvasRenderingContext2D, drawable: Drawable): void {
  for (const set of drawable.sets) {
    if (set.type !== 'path') continue
    ctx.beginPath()
    applyOpSet(ctx, set)
    ctx.stroke()
  }
}

function applyOpSet(ctx: CanvasRenderingContext2D, set: OpSet): void {
  for (const op of set.ops) applyOp(ctx, op)
}

function applyOp(ctx: CanvasRenderingContext2D, op: Op): void {
  const d = op.data
  if (op.op === 'move') {
    ctx.moveTo(d[0]!, d[1]!)
    return
  }
  if (op.op === 'lineTo') {
    ctx.lineTo(d[0]!, d[1]!)
    return
  }
  ctx.bezierCurveTo(d[0]!, d[1]!, d[2]!, d[3]!, d[4]!, d[5]!)
}

function toPair(point: Point): [number, number] {
  return [point.x, point.y]
}
