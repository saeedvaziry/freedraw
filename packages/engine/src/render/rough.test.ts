import { describe, expect, it } from 'vitest'
import { hashSeed, roughnessFor } from './rough.js'

describe('roughnessFor', () => {
  it('maps zero sloppiness to zero roughness', () => {
    expect(roughnessFor(0)).toBe(0)
  })

  it('scales sloppiness up to the maximum roughness', () => {
    expect(roughnessFor(1)).toBeGreaterThan(roughnessFor(0.5))
    expect(roughnessFor(0.5)).toBeGreaterThan(0)
  })

  it('never returns a negative roughness', () => {
    expect(roughnessFor(-1)).toBe(0)
  })
})

describe('hashSeed', () => {
  it('is deterministic for the same id', () => {
    expect(hashSeed('element-1')).toBe(hashSeed('element-1'))
  })

  it('differs across ids', () => {
    expect(hashSeed('element-1')).not.toBe(hashSeed('element-2'))
  })

  it('stays within the 31-bit seed range rough.js expects', () => {
    const seed = hashSeed('a-fairly-long-element-identifier')
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 31)
  })
})
