import { describe, expect, it, vi } from 'vitest'
import { ImageCache } from './image-cache.js'

const BITMAP = { width: 2, height: 2 } as unknown as ImageBitmap

function cacheWith(blob: Blob | undefined, onReady = (): void => {}): ImageCache {
  return new ImageCache({
    loadBlob: () => Promise.resolve(blob),
    decode: () => Promise.resolve(BITMAP),
    onReady,
  })
}

describe('ImageCache', () => {
  it('exposes the loaded blob as a data uri with its original mime type', async () => {
    const cache = cacheWith(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }))
    await cache.ensureBitmaps(['asset-1'])
    expect(cache.getSourceDataUrl('asset-1')).toBe(`data:image/webp;base64,${btoa('\x01\x02\x03')}`)
  })

  it('returns no data uri for an unknown asset', async () => {
    const cache = cacheWith(undefined)
    await cache.ensureBitmaps(['missing'])
    expect(cache.getSourceDataUrl('missing')).toBeUndefined()
  })

  it('ignores blobs that are not images', async () => {
    const cache = cacheWith(new Blob([new Uint8Array([1])], { type: 'text/plain' }))
    await cache.ensureBitmaps(['asset-1'])
    expect(cache.getSourceDataUrl('asset-1')).toBeUndefined()
  })

  it('keeps the source supplied alongside a directly cached bitmap', async () => {
    const loadBlob = vi.fn(() => Promise.resolve(undefined))
    const cache = new ImageCache({ loadBlob, onReady: () => {} })
    cache.set('asset-1', BITMAP, new Blob([new Uint8Array([255])], { type: 'image/png' }))
    await cache.ensureSources(['asset-1'])
    expect(loadBlob).not.toHaveBeenCalled()
    expect(cache.getSourceDataUrl('asset-1')).toBe(`data:image/png;base64,${btoa('\xff')}`)
  })

  it('fetches the blob for a bitmap that was cached without one', async () => {
    const loadBlob = vi.fn(() =>
      Promise.resolve(new Blob([new Uint8Array([7])], { type: 'image/jpeg' })),
    )
    const decode = vi.fn(() => Promise.resolve(BITMAP))
    const cache = new ImageCache({ loadBlob, decode, onReady: () => {} })
    cache.set('asset-1', BITMAP)
    await cache.ensureSources(['asset-1'])
    expect(loadBlob).toHaveBeenCalledTimes(1)
    expect(decode).not.toHaveBeenCalled()
    expect(cache.getSourceDataUrl('asset-1')).toBe(`data:image/jpeg;base64,${btoa('\x07')}`)
  })

  it('loads each asset once for bitmaps and sources', async () => {
    const loadBlob = vi.fn(() =>
      Promise.resolve(new Blob([new Uint8Array([7])], { type: 'image/png' })),
    )
    const cache = new ImageCache({ loadBlob, decode: () => Promise.resolve(BITMAP), onReady: () => {} })
    await Promise.all([cache.ensureBitmaps(['asset-1']), cache.ensureSources(['asset-1'])])
    await cache.ensureSources(['asset-1'])
    expect(loadBlob).toHaveBeenCalledTimes(1)
    expect(cache.getBitmap('asset-1')).toBe(BITMAP)
  })
})
