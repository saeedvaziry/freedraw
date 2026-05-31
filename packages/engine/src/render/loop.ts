export interface RenderLoopHandle {
  start(): void
  stop(): void
  markDirty(): void
}

export function createRenderLoop(onRender: () => void): RenderLoopHandle {
  let needsRender = false
  let running = false
  let frameId = 0

  const tick = (): void => {
    if (!running) return
    if (needsRender) {
      needsRender = false
      onRender()
    }
    frameId = requestAnimationFrame(tick)
  }

  return {
    start(): void {
      if (running) return
      running = true
      needsRender = true
      frameId = requestAnimationFrame(tick)
    },
    stop(): void {
      running = false
      cancelAnimationFrame(frameId)
    },
    markDirty(): void {
      needsRender = true
    },
  }
}
