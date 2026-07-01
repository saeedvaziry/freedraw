import type { ShapeType, Style } from '../model/types.js'
import type { Rect } from '../geometry/rect.js'
import { labelRect } from '../geometry/shape-outline.js'
import { measureTextBox, type TextSize } from './size.js'

export const LABEL_PADDING = 6

export const SHAPE_TEXT_INFLATION: Partial<Record<ShapeType, { x: number; y: number }>> = {
  diamond: { x: 1.7, y: 1.7 },
  ellipse: { x: 1.4, y: 1.4 },
  hexagon: { x: 1.3, y: 1 },
  triangle: { x: 1.6, y: 1.8 },
}

export function shapeTextInflation(type: string): { x: number; y: number } {
  return SHAPE_TEXT_INFLATION[type as ShapeType] ?? { x: 1, y: 1 }
}

export function labelContentSize(type: string, text: string, style: Style): TextSize {
  const measured = measureTextBox(text, style)
  const inflation = shapeTextInflation(type)
  return {
    width: Math.ceil((measured.width + LABEL_PADDING * 2) * inflation.x),
    height: Math.ceil((measured.height + LABEL_PADDING * 2) * inflation.y),
  }
}

function centerRect(anchor: Rect, width: number, height: number): Rect {
  const cx = anchor.x + anchor.width / 2
  const cy = anchor.y + anchor.height / 2
  return { width, height, x: cx - width / 2, y: cy - height / 2 }
}

export function fitShapeToLabel(
  type: string,
  bounds: Rect,
  text: string,
  style: Style,
): Rect | null {
  const content = labelContentSize(type, text, style)
  let width = bounds.width
  let height = bounds.height
  for (let i = 0; i < 4; i += 1) {
    const rect = labelRect(type, { x: bounds.x, y: bounds.y, width, height })
    const capWidth = width - rect.width
    const capHeight = height - rect.height
    const nextWidth = Math.max(bounds.width, Math.ceil(content.width + capWidth))
    const nextHeight = Math.max(bounds.height, Math.ceil(content.height + capHeight))
    if (nextWidth === width && nextHeight === height) break
    width = nextWidth
    height = nextHeight
  }
  if (width === bounds.width && height === bounds.height) return null
  return centerRect(bounds, width, height)
}
