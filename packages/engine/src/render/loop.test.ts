import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderLoop } from './loop.js'

describe('createRenderLoop', () => {
  let frame: () => void
  let rafSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      frame = () => cb(0)
      return 1
    })
    vi.stubGlobal('requestAnimationFrame', rafSpy)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders once on start then stays idle until marked dirty', () => {
    const onRender = vi.fn()
    const loop = createRenderLoop(onRender)

    loop.start()
    frame()
    expect(onRender).toHaveBeenCalledTimes(1)

    frame()
    frame()
    expect(onRender).toHaveBeenCalledTimes(1)

    loop.markDirty()
    frame()
    expect(onRender).toHaveBeenCalledTimes(2)
  })

  it('does not render after stop', () => {
    const onRender = vi.fn()
    const loop = createRenderLoop(onRender)

    loop.start()
    loop.stop()
    loop.markDirty()
    frame()
    expect(onRender).not.toHaveBeenCalled()
  })
})
