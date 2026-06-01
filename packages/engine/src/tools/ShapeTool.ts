import type { Rect } from '../geometry/rect.js'
import type { Point, ShapeElement, ShapeType } from '../model/types.js'
import { createShape } from '../model/factory.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

const MIN_SIZE = 8

export function dragBounds(start: Point, current: Point, square = false): Rect {
  let dx = current.x - start.x
  let dy = current.y - start.y
  if (square) {
    const size = Math.max(Math.abs(dx), Math.abs(dy))
    dx = Math.sign(dx || 1) * size
    dy = Math.sign(dy || 1) * size
  }
  const x = Math.min(start.x, start.x + dx)
  const y = Math.min(start.y, start.y + dy)
  return { x, y, width: Math.abs(dx), height: Math.abs(dy) }
}

export class ShapeTool implements Tool {
  readonly id = 'shape'
  private start: Point | null = null

  constructor(private shapeType: ShapeType) {}

  setShapeType(type: ShapeType): void {
    this.shapeType = type
  }

  onPointerDown(info: PointerInfo): ToolResult {
    this.start = { x: info.world.x, y: info.world.y }
    return {}
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.start) return {}
    const bounds = dragBounds(this.start, info.world, info.shiftKey)
    ctx.setPreview(this.buildElement(bounds, ctx))
    return { overlay: true }
  }

  onPointerUp(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.start) return {}
    const bounds = dragBounds(this.start, info.world, info.shiftKey)
    this.start = null
    ctx.setPreview(null)
    if (bounds.width < MIN_SIZE || bounds.height < MIN_SIZE) return { overlay: true }
    const element = this.buildElement(bounds, ctx)
    ctx.store.transact((api) => api.addElement(element))
    ctx.store.setUiState({ selectedIds: new Set([element.id]), activeTool: 'select' })
    return { scene: true, overlay: true }
  }

  onDeactivate(ctx: ToolContext): void {
    this.start = null
    ctx.setPreview(null)
  }

  private buildElement(bounds: Rect, ctx: ToolContext): ShapeElement {
    return createShape({ type: this.shapeType, ...bounds, style: ctx.store.getLastUsedStyle() })
  }
}
