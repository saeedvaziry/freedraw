import type { Rect } from '../geometry/rect.js'
import type { Point, Style } from '../model/types.js'
import { layoutText, lineHeightFor } from './layout.js'
import { offscreenMeasureContext } from './measure.js'

export const ARROW_LABEL_PADDING_X = 6
export const ARROW_LABEL_PADDING_Y = 2
const ARROW_LABEL_MIN_EDIT_WIDTH = 120

export function polylineMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0]! }

  let total = 0
  const segments: { from: Point; to: Point; length: number }[] = []
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]!
    const to = points[i]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    segments.push({ from, to, length })
    total += length
  }
  if (total === 0) return { ...points[0]! }

  let remaining = total / 2
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const t = segment.length === 0 ? 0 : remaining / segment.length
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t,
      }
    }
    remaining -= segment.length
  }
  return { ...points[points.length - 1]! }
}

export function arrowLabelEditRect(points: Point[], text: string, style: Style): Rect {
  const midpoint = polylineMidpoint(points)
  const size = arrowLabelTextSize(text, style)
  const width = Math.max(ARROW_LABEL_MIN_EDIT_WIDTH, size.width + ARROW_LABEL_PADDING_X * 2)

  return centeredRect(midpoint, width, size.height)
}

export function arrowLabelHitRect(points: Point[], text: string, style: Style): Rect {
  const midpoint = polylineMidpoint(points)
  const size = arrowLabelTextSize(text, style)

  return centeredRect(
    midpoint,
    size.width + ARROW_LABEL_PADDING_X * 2,
    size.height + ARROW_LABEL_PADDING_Y * 2,
  )
}

function arrowLabelTextSize(text: string, style: Style): { width: number; height: number } {
  const measure = offscreenMeasureContext(style.fontSize, style.fontFamily, style)
  const layout = layoutText(
    {
      text: text || ' ',
      width: Infinity,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
    },
    measure,
  )

  return {
    width: Math.ceil(layout.width),
    height: Math.max(lineHeightFor(style.fontSize), layout.height),
  }
}

function centeredRect(center: Point, width: number, height: number): Rect {
  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  }
}
