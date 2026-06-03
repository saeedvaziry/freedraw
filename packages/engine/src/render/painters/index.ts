import type { Element, ShapeType } from '../../model/types.js'
import { paintArrow } from './arrow.js'
import { paintFreedraw } from './freedraw.js'
import { paintImage } from './image.js'
import { paintShape } from './shape.js'
import { paintSticky } from './sticky.js'
import { paintText } from './text.js'

export type Painter = (ctx: CanvasRenderingContext2D, element: Element) => void

const shapeTypes: ShapeType[] = [
  'rect',
  'roundRect',
  'ellipse',
  'diamond',
  'triangle',
  'cylinder',
  'hexagon',
  'parallelogram',
  'star',
  'cloud',
  'heart',
]

const painters: Partial<Record<string, Painter>> = {
  ...Object.fromEntries(shapeTypes.map((type) => [type, paintShape])),
  arrow: paintArrow,
  line: paintArrow,
  text: paintText,
  sticky: paintSticky,
  image: paintImage,
  freedraw: paintFreedraw,
}

export function getPainter(type: string): Painter | undefined {
  return painters[type]
}

export function paintElement(ctx: CanvasRenderingContext2D, element: Element): void {
  const painter = getPainter(element.type)
  if (!painter) return
  if (!element.rotation) {
    painter(ctx, element)
    return
  }
  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(element.rotation)
  ctx.translate(-cx, -cy)
  painter(ctx, element)
  ctx.restore()
}
