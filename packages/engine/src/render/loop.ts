export interface RenderDirty {
  scene: boolean
  overlay: boolean
}

export interface RenderLoopHandle {
  start(): void
  stop(): void
  markDirty(): void
  markSceneDirty(): void
  markOverlayDirty(): void
}

export function createRenderLoop(onRender: (dirty: RenderDirty) => void): RenderLoopHandle {
  let sceneDirty = false
  let overlayDirty = false
  let running = false
  let frameId = 0

  const tick = (): void => {
    if (!running) return
    if (sceneDirty || overlayDirty) {
      const dirty: RenderDirty = { scene: sceneDirty, overlay: overlayDirty }
      sceneDirty = false
      overlayDirty = false
      onRender(dirty)
    }
    frameId = requestAnimationFrame(tick)
  }

  return {
    start(): void {
      if (running) return
      running = true
      // Paint the first frame synchronously so a freshly mounted canvas (which
      // resize() has just cleared to transparent) shows the scene before the
      // browser's next paint — otherwise the canvas flashes blank for one frame
      // on mount and when swapping boards.
      sceneDirty = false
      overlayDirty = false
      onRender({ scene: true, overlay: true })
      frameId = requestAnimationFrame(tick)
    },
    stop(): void {
      running = false
      cancelAnimationFrame(frameId)
    },
    markDirty(): void {
      sceneDirty = true
      overlayDirty = true
    },
    markSceneDirty(): void {
      sceneDirty = true
    },
    markOverlayDirty(): void {
      overlayDirty = true
    },
  }
}
