import type { Rect } from '../geometry/rect.js'
import { snapPointToGrid } from '../geometry/grid.js'
import type { ShapeElement, ShapeType } from '../model/types.js'
import {
  createShape,
  SHAPE_DEFAULT_HEIGHT,
  SHAPE_DEFAULT_WIDTH,
} from '../model/factory.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

const PLACEHOLDER_TEXT = ''
const GHOST_OPACITY = 0.4

export class ShapeTool implements Tool {
  readonly id = 'shape'

  constructor(private shapeType: ShapeType) {}

  setShapeType(type: ShapeType): void {
    this.shapeType = type
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    const ghost = this.buildElement(this.bounds(info), ctx)
    ghost.label = { text: PLACEHOLDER_TEXT, align: 'center', verticalAlign: 'middle' }
    ghost.style = { ...ghost.style, opacity: ghost.style.opacity * GHOST_OPACITY }
    ctx.setPreview(ghost)
    return { overlay: true }
  }

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    const element = this.buildElement(this.bounds(info), ctx)
    ctx.setPreview(null)
    ctx.store.stopCapturing()
    ctx.store.transact((api) => api.addElement(element))
    ctx.store.setUiState({ selectedIds: new Set([element.id]), activeTool: 'select' })
    ctx.beginEdit({
      elementId: element.id,
      target: 'label',
      text: '',
      world: { x: element.x, y: element.y, width: element.width, height: element.height },
      style: element.style,
      align: element.style.textAlign,
      verticalAlign: 'middle',
    })
    return { scene: true, overlay: true }
  }

  onDeactivate(ctx: ToolContext): void {
    ctx.setPreview(null)
  }

  private bounds(info: PointerInfo): Rect {
    const center = snapPointToGrid(info.world)
    return {
      x: center.x - SHAPE_DEFAULT_WIDTH / 2,
      y: center.y - SHAPE_DEFAULT_HEIGHT / 2,
      width: SHAPE_DEFAULT_WIDTH,
      height: SHAPE_DEFAULT_HEIGHT,
    }
  }

  private buildElement(bounds: Rect, ctx: ToolContext): ShapeElement {
    return createShape({ type: this.shapeType, ...bounds, style: ctx.store.getLastUsedStyle() })
  }
}
