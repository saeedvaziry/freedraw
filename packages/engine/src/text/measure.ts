import type { FontStyle } from '../model/types.js'

export interface MeasureContext {
  measureWidth(text: string): number
}

export interface FontEmphasis {
  fontWeight?: number
  fontStyle?: FontStyle
}

export const HANDWRITTEN_FONT_FAMILY = "'Architects Daughter', cursive"

export const NORMAL_FONT_WEIGHT = 400
export const BOLD_THRESHOLD = 600
export const BOLD_CHAR_RATIO_SCALE = 1.06

export function isBoldWeight(emphasis?: FontEmphasis): boolean {
  const weight = emphasis?.fontWeight
  return typeof weight === 'number' && Number.isFinite(weight) && weight >= BOLD_THRESHOLD
}

export function fontString(
  fontSize: number,
  fontFamily: string,
  emphasis?: FontEmphasis,
): string {
  const prefix: string[] = []
  if (emphasis?.fontStyle === 'italic') prefix.push('italic')
  const weight = emphasis?.fontWeight
  if (typeof weight === 'number' && Number.isFinite(weight) && weight !== NORMAL_FONT_WEIGHT) {
    prefix.push(String(Math.round(weight)))
  }
  prefix.push(`${fontSize}px ${fontFamily}`)
  return prefix.join(' ')
}

export function canvasMeasureContext(
  ctx: CanvasRenderingContext2D,
  fontSize: number,
  fontFamily: string,
  emphasis?: FontEmphasis,
): MeasureContext {
  ctx.font = fontString(fontSize, fontFamily, emphasis)
  return {
    measureWidth: (text) => ctx.measureText(text).width,
  }
}

export const AVERAGE_CHAR_RATIO = 0.5

export function approximateMeasureContext(
  fontSize: number,
  emphasis?: FontEmphasis,
): MeasureContext {
  const scale = isBoldWeight(emphasis) ? BOLD_CHAR_RATIO_SCALE : 1
  const charWidth = fontSize * AVERAGE_CHAR_RATIO * scale
  return {
    measureWidth(text: string): number {
      return text.length * charWidth
    },
  }
}

let sharedCtx: CanvasRenderingContext2D | null = null

export function offscreenMeasureContext(
  fontSize: number,
  fontFamily: string,
  emphasis?: FontEmphasis,
): MeasureContext {
  if (typeof document === 'undefined') return approximateMeasureContext(fontSize, emphasis)
  if (!sharedCtx) sharedCtx = document.createElement('canvas').getContext('2d')
  if (!sharedCtx) return approximateMeasureContext(fontSize, emphasis)
  return canvasMeasureContext(sharedCtx, fontSize, fontFamily, emphasis)
}
