import type { ShapeType } from '../model/types.js'
import type { ToolId } from '../store/SceneStore.js'
import { ArrowTool } from './ArrowTool.js'
import { HandTool } from './HandTool.js'
import { SelectTool } from './SelectTool.js'
import { ShapeTool } from './ShapeTool.js'
import { StickyTool } from './StickyTool.js'
import { TextTool } from './TextTool.js'
import type { Tool, ToolContext } from './Tool.js'

export interface SetActiveOptions {
  shapeType?: ShapeType
}

export class ToolManager {
  private readonly selectTool = new SelectTool()
  private readonly shapeTool = new ShapeTool('rect')
  private readonly handTool = new HandTool()
  private readonly arrowTool = new ArrowTool('arrow')
  private readonly lineTool = new ArrowTool('line')
  private readonly textTool = new TextTool()
  private readonly stickyTool = new StickyTool()
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
    if (toolId === 'sticky') return this.stickyTool
    if (toolId === 'shape') {
      if (options.shapeType) this.shapeTool.setShapeType(options.shapeType)
      return this.shapeTool
    }
    return this.selectTool
  }
}
