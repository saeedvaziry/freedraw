import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES, validateImageInput } from './imageInput.js'

describe('validateImageInput', () => {
  it('accepts an image blob within the size cap', () => {
    expect(validateImageInput({ type: 'image/png', size: 1024 })).toEqual({ ok: true })
  })

  it('rejects a non-image MIME type', () => {
    expect(validateImageInput({ type: 'application/pdf', size: 1024 })).toEqual({
      ok: false,
      reason: 'mime',
    })
  })

  it('rejects an over-cap blob', () => {
    expect(validateImageInput({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toEqual({
      ok: false,
      reason: 'size',
    })
  })
})
