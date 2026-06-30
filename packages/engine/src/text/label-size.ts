import type { ShapeType, Style } from '../model/types.js'
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
    width: Math.ceil(measured.width + LABEL_PADDING * 2) * inflation.x,
    height: Math.ceil(measured.height) * inflation.y,
  }
}

export function fitShapeToLabel(
  type: string,
  bounds: { x: number; y: number; width: number; height: number },
  text: string,
  style: Style,
): { x: number; y: number; width: number; height: number } | null {
  const content = labelContentSize(type, text, style)
  const rect = labelRect(type, bounds)
  const capWidth = bounds.width - rect.width
  const capHeight = bounds.height - rect.height
  const width = Math.max(bounds.width, Math.ceil(content.width) + capWidth)
  const height = Math.max(bounds.height, Math.ceil(content.height) + capHeight)
  if (width === bounds.width && height === bounds.height) return null
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return {
    width,
    height,
    x: cx - width / 2,
    y: cy - height / 2,
  }
}
