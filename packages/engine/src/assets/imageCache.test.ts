import { describe, expect, it, vi } from 'vitest'
import { ImageCache } from './imageCache.js'

const fakeBitmap = {} as ImageBitmap

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('ImageCache', () => {
  it('returns undefined first then caches after decode', async () => {
    const onReady = vi.fn()
    const cache = new ImageCache({
      loadBlob: () => Promise.resolve(new Blob()),
      decode: () => Promise.resolve(fakeBitmap),
      onReady,
    })

    expect(cache.getBitmap('a')).toBeUndefined()
    await flush()
    expect(cache.getBitmap('a')).toBe(fakeBitmap)
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent decodes of the same id', async () => {
    const decode = vi.fn(() => Promise.resolve(fakeBitmap))
    const cache = new ImageCache({
      loadBlob: () => Promise.resolve(new Blob()),
      decode,
      onReady: () => undefined,
    })

    cache.getBitmap('a')
    cache.getBitmap('a')
    cache.getBitmap('a')
    await flush()
    expect(decode).toHaveBeenCalledTimes(1)
  })

  it('does not fire repaint when no blob is found', async () => {
    const onReady = vi.fn()
    const cache = new ImageCache({
      loadBlob: () => Promise.resolve(undefined),
      decode: () => Promise.resolve(fakeBitmap),
      onReady,
    })

    cache.getBitmap('missing')
    await flush()
    expect(cache.getBitmap('missing')).toBeUndefined()
    expect(onReady).not.toHaveBeenCalled()
  })

  it('serves a directly-seeded bitmap without decoding', () => {
    const decode = vi.fn(() => Promise.resolve(fakeBitmap))
    const cache = new ImageCache({
      loadBlob: () => Promise.resolve(new Blob()),
      decode,
      onReady: () => undefined,
    })

    cache.set('seeded', fakeBitmap)
    expect(cache.getBitmap('seeded')).toBe(fakeBitmap)
    expect(decode).not.toHaveBeenCalled()
  })
})
