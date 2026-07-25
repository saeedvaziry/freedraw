import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { encoded, encodeDocAsBase64, updateRemotePage } = vi.hoisted(() => ({
  encoded: { current: 'doc-a' },
  encodeDocAsBase64: vi.fn(),
  updateRemotePage: vi.fn(),
}))

vi.mock('./page-api.js', () => ({ encodeDocAsBase64, updateRemotePage }))

import { createPageSync } from './page-sync.js'

describe('createPageSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    encoded.current = 'doc-a'
    encodeDocAsBase64.mockReset()
    encodeDocAsBase64.mockImplementation(() => encoded.current)
    updateRemotePage.mockReset()
    updateRemotePage.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts saved and skips the request when the document is unchanged', async () => {
    const doc = new Y.Doc()
    const sync = createPageSync(doc, 'page-1', 'doc-a')

    expect(sync.getStatus()).toBe('saved')

    await vi.advanceTimersByTimeAsync(1000)

    expect(updateRemotePage).not.toHaveBeenCalled()
    expect(sync.getStatus()).toBe('saved')

    sync.destroy()
  })

  it('reports saving then saved around a successful write', async () => {
    const doc = new Y.Doc()
    const sync = createPageSync(doc, 'page-1', null)
    const seen: string[] = []
    sync.subscribe(() => seen.push(sync.getStatus()))

    doc.getMap('scene').set('a', 1)
    await vi.advanceTimersByTimeAsync(1000)

    expect(updateRemotePage).toHaveBeenCalledWith('page-1', { document: 'doc-a' })
    expect(seen).toEqual(['saving', 'saved'])
    expect(sync.getStatus()).toBe('saved')

    sync.destroy()
  })

  it('falls back to offline when the write fails and recovers on the retry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    updateRemotePage.mockRejectedValueOnce(new Error('network down'))

    const doc = new Y.Doc()
    const sync = createPageSync(doc, 'page-1', null)

    doc.getMap('scene').set('a', 1)
    await vi.advanceTimersByTimeAsync(1000)

    expect(sync.getStatus()).toBe('offline')

    await vi.advanceTimersByTimeAsync(1000)

    expect(updateRemotePage).toHaveBeenCalledTimes(2)
    expect(sync.getStatus()).toBe('saved')

    sync.destroy()
  })

  it('stops saving and notifying once destroyed', async () => {
    const doc = new Y.Doc()
    const sync = createPageSync(doc, 'page-1', null)
    const listener = vi.fn()
    sync.subscribe(listener)

    sync.destroy()
    doc.getMap('scene').set('a', 1)
    await vi.advanceTimersByTimeAsync(1000)

    expect(updateRemotePage).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })
})
