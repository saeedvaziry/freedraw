export interface MeasureContext {
  measureWidth(text: string): number
}

export const HANDWRITTEN_FONT_FAMILY = "'Architects Daughter', cursive"

export function fontString(fontSize: number, fontFamily: string): string {
  return `${fontSize}px ${fontFamily}`
}

export function canvasMeasureContext(
  ctx: CanvasRenderingContext2D,
  fontSize: number,
  fontFamily: string,
): MeasureContext {
  ctx.font = fontString(fontSize, fontFamily)
  return {
    measureWidth: (text) => ctx.measureText(text).width,
  }
}

export const AVERAGE_CHAR_RATIO = 0.5

export function approximateMeasureContext(fontSize: number): MeasureContext {
  const charWidth = fontSize * AVERAGE_CHAR_RATIO
  return {
    measureWidth(text: string): number {
      return text.length * charWidth
    },
  }
}

let sharedCtx: CanvasRenderingContext2D | null = null

export function offscreenMeasureContext(fontSize: number, fontFamily: string): MeasureContext {
  if (typeof document === 'undefined') return approximateMeasureContext(fontSize)
  if (!sharedCtx) sharedCtx = document.createElement('canvas').getContext('2d')
  if (!sharedCtx) return approximateMeasureContext(fontSize)
  return canvasMeasureContext(sharedCtx, fontSize, fontFamily)
}
