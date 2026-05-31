import { describe, expect, it } from 'vitest'
import { measureTextBox, MIN_TEXT_WIDTH, TEXT_BOX_PADDING_Y } from './size.js'
import { lineHeightFor } from './layout.js'
import { defaultStyle } from '../model/schema.js'

describe('measureTextBox', () => {
  it('grows wider for longer single-line text', () => {
    const short = measureTextBox('hi', defaultStyle)
    const long = measureTextBox('a much longer line of text', defaultStyle)
    expect(long.width).toBeGreaterThan(short.width)
  })

  it('grows taller with more lines', () => {
    const one = measureTextBox('one', defaultStyle)
    const three = measureTextBox('one\ntwo\nthree', defaultStyle)
    expect(three.height).toBeGreaterThan(one.height)
  })

  it('never shrinks below the minimum width', () => {
    expect(measureTextBox('', defaultStyle).width).toBeGreaterThanOrEqual(MIN_TEXT_WIDTH)
  })

  it('sizes a single line to one line height plus padding', () => {
    const size = measureTextBox('x', defaultStyle)
    expect(size.height).toBeCloseTo(lineHeightFor(defaultStyle.fontSize) + TEXT_BOX_PADDING_Y * 2)
  })
})
