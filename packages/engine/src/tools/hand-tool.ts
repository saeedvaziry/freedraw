import type { PointerInfo, Tool, ToolContext, ToolResult } from './tool.js'

export class HandTool implements Tool {
  readonly id = 'hand'
  private panning = false
  private last = { x: 0, y: 0 }

  onPointerDown(info: PointerInfo): ToolResult {
    this.panning = true
    this.last = { x: info.screen.x, y: info.screen.y }
    return {}
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.panning) return {}
    ctx.camera.panByScreen(info.screen.x - this.last.x, info.screen.y - this.last.y)
    this.last = { x: info.screen.x, y: info.screen.y }
    return { scene: true, overlay: true }
  }

  onPointerUp(_info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.panning) return {}
    this.panning = false
    ctx.store.commitCamera(ctx.camera.state)
    return { scene: true }
  }
}
