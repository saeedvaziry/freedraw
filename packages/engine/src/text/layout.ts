import type { MeasureContext } from './measure.js'

export type TextAlign = 'left' | 'center' | 'right'
export type VerticalAlign = 'top' | 'middle' | 'bottom'

export interface TextLayoutInput {
  text: string
  width: number
  fontSize: number
  fontFamily: string
  lineHeight?: number
}

export interface TextLayout {
  lines: string[]
  width: number
  height: number
  lineHeight: number
}

export const DEFAULT_LINE_HEIGHT_RATIO = 1.25

export function lineHeightFor(fontSize: number, ratio = DEFAULT_LINE_HEIGHT_RATIO): number {
  return fontSize * ratio
}

export function layoutText(input: TextLayoutInput, measure: MeasureContext): TextLayout {
  const lineHeight = input.lineHeight ?? lineHeightFor(input.fontSize)
  const lines = wrapText(input.text, input.width, measure)
  const width = lines.reduce((max, line) => Math.max(max, measure.measureWidth(line)), 0)
  return {
    lines,
    width,
    height: lines.length * lineHeight,
    lineHeight,
  }
}

export function wrapText(text: string, maxWidth: number, measure: MeasureContext): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('')
      continue
    }
    lines.push(...wrapParagraph(paragraph, maxWidth, measure))
  }
  return lines
}

function wrapParagraph(paragraph: string, maxWidth: number, measure: MeasureContext): string[] {
  if (maxWidth <= 0) return [paragraph]
  const tokens = paragraph.split(/(\s+)/).filter((token) => token.length > 0)
  const lines: string[] = []
  let current = ''
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (current.length > 0) current += token
      continue
    }
    const candidate = current + token
    if (current.length > 0 && measure.measureWidth(candidate.trimEnd()) > maxWidth) {
      lines.push(current.trimEnd())
      current = ''
    }
    if (current.length === 0 && measure.measureWidth(token) > maxWidth) {
      const broken = breakWord(token, maxWidth, measure)
      for (let i = 0; i < broken.length - 1; i += 1) lines.push(broken[i]!)
      current = broken[broken.length - 1] ?? ''
      continue
    }
    current += token
  }
  if (current.trimEnd().length > 0 || lines.length === 0) lines.push(current.trimEnd())
  return lines
}

function breakWord(word: string, maxWidth: number, measure: MeasureContext): string[] {
  const segments: string[] = []
  let current = ''
  for (const char of word) {
    const candidate = current + char
    if (current && measure.measureWidth(candidate) > maxWidth) {
      segments.push(current)
      current = char
      continue
    }
    current = candidate
  }
  if (current.length > 0) segments.push(current)
  return segments
}
