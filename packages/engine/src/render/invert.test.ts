import { describe, expect, it } from 'vitest'
import { invertColor } from './invert.js'

describe('invertColor', () => {
  it('keeps transparent untouched', () => {
    expect(invertColor('transparent')).toBe('transparent')
  })

  it('flips grayscale lightness', () => {
    expect(invertColor('#000000')).toBe('#ffffff')
    expect(invertColor('#ffffff')).toBe('#000000')
    expect(invertColor('#1e1e1e')).toBe('#e1e1e1')
  })

  it('preserves hue for saturated colors', () => {
    expect(invertColor('#f00')).toBe('#ff0000')
    expect(invertColor('#2f9e44')).toBe('#61d076')
  })

  it('lightens dark colors while keeping their hue', () => {
    expect(invertColor('rgb(0, 0, 0)')).toBe('rgb(255, 255, 255)')
    expect(invertColor('rgb(31, 41, 55)')).toBe('rgb(200, 210, 224)')
  })

  it('inverts rgba lightness preserving alpha', () => {
    expect(invertColor('rgba(31, 41, 55, 0.035)')).toBe('rgba(200, 210, 224, 0.035)')
  })

  it('returns unknown formats unchanged', () => {
    expect(invertColor('hsl(0, 0%, 0%)')).toBe('hsl(0, 0%, 0%)')
  })
})
