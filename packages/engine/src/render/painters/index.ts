import type { Element, ShapeType } from '../../model/types.js'
import { paintArrow } from './arrow.js'
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
}

export function getPainter(type: string): Painter | undefined {
  return painters[type]
}
