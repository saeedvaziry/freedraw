import { describe, expect, it } from 'vitest'
import { layoutText, lineHeightFor, wrapText } from './layout.js'
import type { MeasureContext } from './measure.js'

const measure: MeasureContext = {
  measureWidth: (text) => text.length * 10,
}

describe('wrapText', () => {
  it('keeps a short line intact', () => {
    expect(wrapText('hello', 100, measure)).toEqual(['hello'])
  })

  it('wraps words to fit the width', () => {
    expect(wrapText('one two three', 80, measure)).toEqual(['one two', 'three'])
  })

  it('preserves explicit newlines as separate lines', () => {
    expect(wrapText('a\nb', 100, measure)).toEqual(['a', 'b'])
  })

  it('keeps a blank line for an empty paragraph', () => {
    expect(wrapText('a\n\nb', 100, measure)).toEqual(['a', '', 'b'])
  })

  it('breaks a single word longer than the width', () => {
    expect(wrapText('abcdef', 30, measure)).toEqual(['abc', 'def'])
  })

  it('does not wrap when width is non-positive', () => {
    expect(wrapText('one two three', 0, measure)).toEqual(['one two three'])
  })
})

describe('layoutText', () => {
  it('computes height from line count and line height', () => {
    const layout = layoutText(
      { text: 'one two three', width: 80, fontSize: 16, fontFamily: 'Inter' },
      measure,
    )
    expect(layout.lines).toEqual(['one two', 'three'])
    expect(layout.lineHeight).toBe(lineHeightFor(16))
    expect(layout.height).toBe(2 * lineHeightFor(16))
  })

  it('reports the widest line width', () => {
    const layout = layoutText(
      { text: 'aa\nbbbb', width: 1000, fontSize: 16, fontFamily: 'Inter' },
      measure,
    )
    expect(layout.width).toBe(40)
  })
})
