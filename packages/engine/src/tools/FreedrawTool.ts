import type { FreedrawElement, Point } from '../model/types.js'
import { createFreedraw } from '../model/factory.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

const MIN_POINTS = 2

export class FreedrawTool implements Tool {
  readonly id = 'freedraw'

  private points: Point[] = []
  private drawing = false

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    ctx.store.stopCapturing()
    this.drawing = true
    this.points = [info.world]
    ctx.setPreview(this.buildElement(ctx))
    return { overlay: true }
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.drawing) return {}
    this.points.push(info.world)
    ctx.setPreview(this.buildElement(ctx))
    return { overlay: true }
  }

  onPointerUp(_info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.drawing) return {}
    this.drawing = false
    ctx.setPreview(null)

    if (this.points.length < MIN_POINTS) {
      this.points = []
      return { overlay: true }
    }

    const element = this.buildElement(ctx)
    this.points = []
    ctx.store.transact((api) => api.addElement(element))
    ctx.store.stopCapturing()
    return { scene: true, overlay: true }
  }

  onDeactivate(ctx: ToolContext): void {
    this.drawing = false
    this.points = []
    ctx.setPreview(null)
  }

  private buildElement(ctx: ToolContext): FreedrawElement {
    return createFreedraw({ points: this.points, style: ctx.store.getLastUsedStyle() })
  }
}
