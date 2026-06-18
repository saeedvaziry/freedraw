import type { StickyColor } from '../model/factory.js'
import type { ShapeType } from '../model/types.js'
import type { ToolId } from '../store/scene-store.js'
import { ArrowTool } from './arrow-tool.js'
import { FreedrawTool } from './freedraw-tool.js'
import { HandTool } from './hand-tool.js'
import { SelectTool } from './select-tool.js'
import { ShapeTool } from './shape-tool.js'
import { StickyTool } from './sticky-tool.js'
import { TextTool } from './text-tool.js'
import type { Tool, ToolContext } from './tool.js'

export interface SetActiveOptions {
  shapeType?: ShapeType
  stickyColor?: StickyColor
}

export class ToolManager {
  private readonly selectTool = new SelectTool()
  private readonly shapeTool = new ShapeTool('rect')
  private readonly handTool = new HandTool()
  private readonly arrowTool = new ArrowTool('arrow')
  private readonly lineTool = new ArrowTool('line')
  private readonly textTool = new TextTool()
  private readonly stickyTool = new StickyTool()
  private readonly freedrawTool = new FreedrawTool()
  private active: Tool

  constructor(private readonly ctx: ToolContext) {
    this.active = this.selectTool
  }

  get activeTool(): Tool {
    return this.active
  }

  setActive(toolId: ToolId, options: SetActiveOptions = {}): void {
    const next = this.resolve(toolId, options)
    if (next === this.active) return
    const previous = this.active
    this.active = next
    previous.onDeactivate?.(this.ctx)
    next.onActivate?.(this.ctx)
  }

  private resolve(toolId: ToolId, options: SetActiveOptions): Tool {
    if (toolId === 'select') return this.selectTool
    if (toolId === 'hand') return this.handTool
    if (toolId === 'arrow') return this.arrowTool
    if (toolId === 'line') return this.lineTool
    if (toolId === 'text') return this.textTool
    if (toolId === 'sticky') {
      if (options.stickyColor) this.stickyTool.setColor(options.stickyColor)
      return this.stickyTool
    }
    if (toolId === 'freedraw') return this.freedrawTool
    if (toolId === 'shape') {
      if (options.shapeType) this.shapeTool.setShapeType(options.shapeType)
      return this.shapeTool
    }
    return this.selectTool
  }
}
