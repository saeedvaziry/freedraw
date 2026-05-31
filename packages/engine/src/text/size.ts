import { layoutText, lineHeightFor } from './layout.js'
import { offscreenMeasureContext } from './measure.js'
import type { Style } from '../model/types.js'

export const TEXT_BOX_PADDING_X = 8
export const TEXT_BOX_PADDING_Y = 4
export const MIN_TEXT_WIDTH = 24

export interface TextSize {
  width: number
  height: number
}

export function measureTextBox(text: string, style: Style): TextSize {
  const measure = offscreenMeasureContext(style.fontSize, style.fontFamily)
  const layout = layoutText(
    { text: text || ' ', width: Infinity, fontSize: style.fontSize, fontFamily: style.fontFamily },
    measure,
  )
  const lineHeight = lineHeightFor(style.fontSize)
  return {
    width: Math.max(MIN_TEXT_WIDTH, Math.ceil(layout.width) + TEXT_BOX_PADDING_X * 2),
    height: Math.max(lineHeight, layout.height) + TEXT_BOX_PADDING_Y * 2,
  }
}
