import type { Rect } from './rect.js'
import type { Point } from '../model/types.js'

export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
  ): void
  closePath(): void
}

export type Outline =
  | { kind: 'polygon'; points: Point[] }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'path'; build: (ctx: PathSink) => void }

type OutlineFn = (bounds: Rect, roundness: number) => Outline

function rectOutline(bounds: Rect, roundness: number): Outline {
  if (roundness > 0) return roundRectOutline(bounds, roundness)
  const { x, y, width, height } = bounds
  return {
    kind: 'polygon',
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  }
}

function diamond({ x, y, width, height }: Rect): Outline {
  const cx = x + width / 2
  const cy = y + height / 2
  return {
    kind: 'polygon',
    points: [
      { x: cx, y },
      { x: x + width, y: cy },
      { x: cx, y: y + height },
      { x, y: cy },
    ],
  }
}

function triangle({ x, y, width, height }: Rect): Outline {
  return {
    kind: 'polygon',
    points: [
      { x: x + width / 2, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  }
}

function hexagon(bounds: Rect): Outline {
  const { x, y, width, height } = bounds
  const inset = width * 0.25
  const cy = y + height / 2
  return {
    kind: 'polygon',
    points: [
      { x: x + inset, y },
      { x: x + width - inset, y },
      { x: x + width, y: cy },
      { x: x + width - inset, y: y + height },
      { x: x + inset, y: y + height },
      { x, y: cy },
    ],
  }
}

function parallelogram(bounds: Rect): Outline {
  const { x, y, width, height } = bounds
  const slant = width * 0.25
  return {
    kind: 'polygon',
    points: [
      { x: x + slant, y },
      { x: x + width, y },
      { x: x + width - slant, y: y + height },
      { x, y: y + height },
    ],
  }
}

function star(bounds: Rect): Outline {
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  const outerX = bounds.width / 2
  const outerY = bounds.height / 2
  const innerRatio = 0.4
  const points: Point[] = []
  const spikes = 5
  const start = -Math.PI / 2
  for (let i = 0; i < spikes * 2; i += 1) {
    const isOuter = i % 2 === 0
    const angle = start + (i / (spikes * 2)) * Math.PI * 2
    const rx = isOuter ? outerX : outerX * innerRatio
    const ry = isOuter ? outerY : outerY * innerRatio
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
  }
  return { kind: 'polygon', points }
}

function ellipseOutline({ x, y, width, height }: Rect): Outline {
  return {
    kind: 'ellipse',
    cx: x + width / 2,
    cy: y + height / 2,
    rx: width / 2,
    ry: height / 2,
  }
}

function roundRectOutline(bounds: Rect, roundness: number): Outline {
  const radius = Math.min(roundness, bounds.width / 2, bounds.height / 2)
  return {
    kind: 'path',
    build: (ctx) => traceRoundRect(ctx, bounds, radius),
  }
}

function cylinderOutline(bounds: Rect): Outline {
  const { x, y, width, height } = bounds
  const ellipseHeight = Math.min(height * 0.25, width * 0.5)
  const ry = ellipseHeight / 2
  const rx = width / 2
  const cx = x + width / 2
  return {
    kind: 'path',
    build: (ctx) => {
      ctx.moveTo(x, y + ry)
      ctx.ellipse(cx, y + ry, rx, ry, 0, Math.PI, Math.PI * 2)
      ctx.lineTo(x + width, y + height - ry)
      ctx.ellipse(cx, y + height - ry, rx, ry, 0, 0, Math.PI)
      ctx.lineTo(x, y + ry)
    },
  }
}

function cloudOutline(bounds: Rect): Outline {
  const { x, y, width, height } = bounds
  const w = width
  const h = height
  return {
    kind: 'path',
    build: (ctx) => {
      ctx.moveTo(x + w * 0.25, y + h * 0.85)
      ctx.bezierCurveTo(x - w * 0.05, y + h * 0.85, x - w * 0.05, y + h * 0.45, x + w * 0.22, y + h * 0.45)
      ctx.bezierCurveTo(x + w * 0.18, y + h * 0.1, x + w * 0.55, y + h * 0.05, x + w * 0.62, y + h * 0.32)
      ctx.bezierCurveTo(x + w * 0.78, y + h * 0.12, x + w * 1.02, y + h * 0.32, x + w * 0.86, y + h * 0.52)
      ctx.bezierCurveTo(x + w * 1.05, y + h * 0.55, x + w * 1.02, y + h * 0.88, x + w * 0.78, y + h * 0.85)
      ctx.closePath()
    },
  }
}

function heartOutline(bounds: Rect): Outline {
  const { x, y, width, height } = bounds
  const w = width
  const h = height
  const cx = x + w / 2
  return {
    kind: 'path',
    build: (ctx) => {
      ctx.moveTo(cx, y + h * 0.95)
      ctx.bezierCurveTo(x - w * 0.05, y + h * 0.55, x + w * 0.1, y - h * 0.05, cx, y + h * 0.3)
      ctx.bezierCurveTo(x + w * 0.9, y - h * 0.05, x + w * 1.05, y + h * 0.55, cx, y + h * 0.95)
      ctx.closePath()
    },
  }
}

const outlineFns: Record<string, OutlineFn> = {
  rect: rectOutline,
  roundRect: roundRectOutline,
  ellipse: ellipseOutline,
  diamond,
  triangle,
  cylinder: cylinderOutline,
  hexagon,
  parallelogram,
  star,
  cloud: cloudOutline,
  heart: heartOutline,
}

export function getOutline(type: string, bounds: Rect, roundness = 0): Outline | undefined {
  return outlineFns[type]?.(bounds, roundness)
}

export function outlinePathD(outline: Outline): string {
  const recorder = new SvgPathRecorder()
  traceOutline(recorder, outline)
  return recorder.toString()
}

class SvgPathRecorder implements PathSink {
  private readonly commands: string[] = []
  private last: Point = { x: 0, y: 0 }

  moveTo(x: number, y: number): void {
    this.last = { x, y }
    this.commands.push(`M ${x} ${y}`)
  }

  lineTo(x: number, y: number): void {
    this.last = { x, y }
    this.commands.push(`L ${x} ${y}`)
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void {
    this.last = { x, y }
    this.commands.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${x} ${y}`)
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    const corner = { x: x1, y: y1 }
    const start = pointTowards(corner, this.last, radius)
    const end = pointTowards(corner, { x: x2, y: y2 }, radius)
    this.commands.push(`L ${start.x} ${start.y}`)
    this.commands.push(`Q ${corner.x} ${corner.y}, ${end.x} ${end.y}`)
    this.last = end
  }

  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    _rotation: number,
    startAngle: number,
    endAngle: number,
  ): void {
    const segments = Math.max(2, Math.ceil((Math.abs(endAngle - startAngle) / Math.PI) * 4))
    const step = (endAngle - startAngle) / segments
    const start = { x: cx + rx * Math.cos(startAngle), y: cy + ry * Math.sin(startAngle) }
    this.commands.push(`L ${start.x} ${start.y}`)
    const kappa = (4 / 3) * Math.tan(step / 4)
    for (let i = 0; i < segments; i += 1) {
      const a0 = startAngle + step * i
      const a1 = a0 + step
      const p0 = { x: cx + rx * Math.cos(a0), y: cy + ry * Math.sin(a0) }
      const p1 = { x: cx + rx * Math.cos(a1), y: cy + ry * Math.sin(a1) }
      const c1 = { x: p0.x - kappa * rx * Math.sin(a0), y: p0.y + kappa * ry * Math.cos(a0) }
      const c2 = { x: p1.x + kappa * rx * Math.sin(a1), y: p1.y - kappa * ry * Math.cos(a1) }
      this.commands.push(`C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p1.x} ${p1.y}`)
    }
    this.last = { x: cx + rx * Math.cos(endAngle), y: cy + ry * Math.sin(endAngle) }
  }

  closePath(): void {
    this.commands.push('Z')
  }

  toString(): string {
    return this.commands.join(' ')
  }
}

function pointTowards(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const ratio = Math.min(distance, length) / length
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

export function traceOutline(ctx: PathSink, outline: Outline): void {
  if (outline.kind === 'polygon') {
    outline.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.closePath()
    return
  }
  if (outline.kind === 'ellipse') {
    ctx.ellipse(outline.cx, outline.cy, outline.rx, outline.ry, 0, 0, Math.PI * 2)
    return
  }
  outline.build(ctx)
}

function traceRoundRect(
  ctx: PathSink,
  { x, y, width, height }: Rect,
  radius: number,
): void {
  const r = Math.max(0, radius)
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + r, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y + height - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (!a || !b) continue
    const intersect =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (intersect) inside = !inside
  }
  return inside
}
