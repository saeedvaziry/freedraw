import { describe, expect, it } from 'vitest'
import { contrastColor, displayColor, isTransparentKeyword, normalizeHex, rgbToHex } from './color.js'

describe('normalizeHex', () => {
  it('expands shorthand hex', () => {
    expect(normalizeHex('#f0a')).toBe('#ff00aa')
    expect(normalizeHex('f0a')).toBe('#ff00aa')
  })

  it('lowercases and keeps long hex', () => {
    expect(normalizeHex('#1971C2')).toBe('#1971c2')
    expect(normalizeHex('  1971c2  ')).toBe('#1971c2')
  })

  it('rejects anything else', () => {
    expect(normalizeHex('transparent')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('rgb(1,2,3)')).toBeNull()
    expect(normalizeHex('')).toBeNull()
  })
})

describe('isTransparentKeyword', () => {
  it('accepts transparent and none', () => {
    expect(isTransparentKeyword('transparent')).toBe(true)
    expect(isTransparentKeyword(' None ')).toBe(true)
    expect(isTransparentKeyword('#ffffff')).toBe(false)
  })
})

describe('rgbToHex', () => {
  it('clamps and pads channels', () => {
    expect(rgbToHex(224, 49, 49)).toBe('#e03131')
    expect(rgbToHex(-5, 300, 0)).toBe('#00ff00')
  })
})

describe('contrastColor', () => {
  it('picks dark ink on light backgrounds', () => {
    expect(contrastColor('#ffffff')).toBe('#1e1e1e')
    expect(contrastColor('#1e1e1e')).toBe('#ffffff')
    expect(contrastColor('transparent')).toBe('#1e1e1e')
  })
})

describe('displayColor', () => {
  it('labels transparency and uppercases hex', () => {
    expect(displayColor('transparent')).toBe('None')
    expect(displayColor('#1971c2')).toBe('#1971C2')
    expect(displayColor('#abc')).toBe('#AABBCC')
  })
})
