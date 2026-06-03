import { describe, expect, it } from 'vitest'
import { freedrawSize } from './freedraw.js'

describe('freedrawSize', () => {
  it('scales the stroke width into a brush size', () => {
    expect(freedrawSize(2)).toBe(8)
    expect(freedrawSize(4)).toBe(16)
  })

  it('keeps a positive size for a zero stroke width', () => {
    expect(freedrawSize(0)).toBeGreaterThan(0)
  })
})
