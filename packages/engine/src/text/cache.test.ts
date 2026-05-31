import { describe, expect, it, vi } from 'vitest'
import { LayoutCache, layoutKey } from './cache.js'
import type { MeasureContext } from './measure.js'
import type { TextLayoutInput } from './layout.js'

function makeMeasure(): MeasureContext {
  return { measureWidth: vi.fn((text: string) => text.length * 10) }
}

const base: TextLayoutInput = { text: 'hello world', width: 80, fontSize: 16, fontFamily: 'Inter' }

describe('LayoutCache', () => {
  it('reuses the layout when key is unchanged', () => {
    const cache = new LayoutCache()
    const measure = makeMeasure()
    const first = cache.get('a', base, measure)
    const second = cache.get('a', base, measure)
    expect(second).toBe(first)
  })

  it('recomputes when text changes', () => {
    const cache = new LayoutCache()
    const measure = makeMeasure()
    const first = cache.get('a', base, measure)
    const next = cache.get('a', { ...base, text: 'changed' }, measure)
    expect(next).not.toBe(first)
  })

  it('recomputes when width changes', () => {
    const cache = new LayoutCache()
    const first = cache.get('a', base, makeMeasure())
    const next = cache.get('a', { ...base, width: 200 }, makeMeasure())
    expect(next).not.toBe(first)
  })

  it('recomputes when font size changes', () => {
    const cache = new LayoutCache()
    const first = cache.get('a', base, makeMeasure())
    const next = cache.get('a', { ...base, fontSize: 24 }, makeMeasure())
    expect(next).not.toBe(first)
  })

  it('invalidate forces a recompute', () => {
    const cache = new LayoutCache()
    const first = cache.get('a', base, makeMeasure())
    cache.invalidate('a')
    const next = cache.get('a', base, makeMeasure())
    expect(next).not.toBe(first)
  })

  it('keys distinguish content and style', () => {
    expect(layoutKey(base)).not.toBe(layoutKey({ ...base, fontSize: 20 }))
    expect(layoutKey(base)).toBe(layoutKey({ ...base, width: base.width + 0.4 }))
  })
})
