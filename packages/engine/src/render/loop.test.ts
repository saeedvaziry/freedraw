import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderLoop, type RenderDirty } from './loop.js'

describe('createRenderLoop', () => {
  let frame: (() => void) | null = null

  beforeEach(() => {
    frame = null
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      frame = cb
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {
      frame = null
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const flush = (): void => {
    const cb = frame
    frame = null
    cb?.()
  }

  const record = (): { loop: ReturnType<typeof createRenderLoop>; renders: RenderDirty[] } => {
    const renders: RenderDirty[] = []
    const loop = createRenderLoop((dirty) => renders.push(dirty))
    loop.start()
    renders.length = 0
    return { loop, renders }
  }

  it('paints both layers synchronously on start', () => {
    const renders: RenderDirty[] = []
    createRenderLoop((dirty) => renders.push(dirty)).start()
    expect(renders).toEqual([{ scene: true, overlay: true }])
  })

  it('does not render when nothing is dirty', () => {
    const { renders } = record()
    flush()
    expect(renders).toEqual([])
  })

  it('marks only the overlay dirty', () => {
    const { loop, renders } = record()
    loop.markOverlayDirty()
    flush()
    expect(renders).toEqual([{ scene: false, overlay: true }])
  })

  it('marks only the scene dirty', () => {
    const { loop, renders } = record()
    loop.markSceneDirty()
    flush()
    expect(renders).toEqual([{ scene: true, overlay: false }])
  })

  it('markDirty dirties both layers', () => {
    const { loop, renders } = record()
    loop.markDirty()
    flush()
    expect(renders).toEqual([{ scene: true, overlay: true }])
  })

  it('coalesces marks into one frame then resets the flags', () => {
    const { loop, renders } = record()
    loop.markOverlayDirty()
    loop.markOverlayDirty()
    loop.markSceneDirty()
    flush()
    expect(renders).toEqual([{ scene: true, overlay: true }])
    flush()
    expect(renders).toEqual([{ scene: true, overlay: true }])
  })

  it('stops rendering after stop()', () => {
    const { loop, renders } = record()
    loop.stop()
    loop.markDirty()
    flush()
    expect(renders).toEqual([])
  })
})
