import { describe, expect, it } from 'vitest'
import {
  approximateMeasureContext,
  BOLD_CHAR_RATIO_SCALE,
  fontString,
  isBoldWeight,
} from './measure.js'
import { layoutKey } from './cache.js'

describe('fontString', () => {
  it('keeps the plain size and family form for a regular weight', () => {
    expect(fontString(20, 'Inter')).toBe('20px Inter')
    expect(fontString(20, 'Inter', { fontWeight: 400, fontStyle: 'normal' })).toBe('20px Inter')
  })

  it('prefixes italic and a non-default weight', () => {
    expect(fontString(20, 'Inter', { fontWeight: 700 })).toBe('700 20px Inter')
    expect(fontString(20, 'Inter', { fontStyle: 'italic' })).toBe('italic 20px Inter')
    expect(fontString(20, 'Inter', { fontWeight: 700, fontStyle: 'italic' })).toBe(
      'italic 700 20px Inter',
    )
  })

  it('ignores a non-finite weight', () => {
    expect(fontString(20, 'Inter', { fontWeight: Number.NaN })).toBe('20px Inter')
  })
})

describe('isBoldWeight', () => {
  it('treats weights at or above the bold threshold as bold', () => {
    expect(isBoldWeight()).toBe(false)
    expect(isBoldWeight({ fontWeight: 400 })).toBe(false)
    expect(isBoldWeight({ fontWeight: 600 })).toBe(true)
    expect(isBoldWeight({ fontWeight: 700 })).toBe(true)
  })
})

describe('approximateMeasureContext', () => {
  it('widens bold text so DOM-less hit boxes stay close', () => {
    const regular = approximateMeasureContext(20).measureWidth('hello')
    const bold = approximateMeasureContext(20, { fontWeight: 700 }).measureWidth('hello')

    expect(bold).toBeCloseTo(regular * BOLD_CHAR_RATIO_SCALE)
  })
})

describe('layoutKey', () => {
  it('separates cache entries by weight and slant', () => {
    const base = { text: 'hi', width: 100, fontSize: 20, fontFamily: 'Inter' }

    expect(layoutKey(base)).not.toBe(layoutKey({ ...base, fontWeight: 700 }))
    expect(layoutKey(base)).not.toBe(layoutKey({ ...base, fontStyle: 'italic' }))
    expect(layoutKey({ ...base, fontWeight: 700 })).toBe(layoutKey({ ...base, fontWeight: 700 }))
  })
})
