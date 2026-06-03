import {
  createSticky,
  DEFAULT_STICKY_COLOR,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_WIDTH,
  type StickyColor,
} from '../model/factory.js'
import type { Rect } from '../geometry/rect.js'
import { snapPointToGrid } from '../geometry/grid.js'
import type { Point, StickyElement } from '../model/types.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

const GHOST_OPACITY = 0.4
const DRAG_THRESHOLD = 4

export class StickyTool implements Tool {
  readonly id = 'sticky'
  private start: Point | null = null

  constructor(private color: StickyColor = DEFAULT_STICKY_COLOR) {}

  setColor(color: StickyColor): void {
    this.color = color
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    const bounds = this.start ? this.dragBounds(this.start, info.world) : this.defaultBounds(info.world)
    const ghost = this.buildElement(bounds, ctx)
    ghost.label = { text: '', align: 'center', verticalAlign: 'middle' }
    ghost.style = { ...ghost.style, opacity: ghost.style.opacity * GHOST_OPACITY }
    ctx.setPreview(ghost)
    return { overlay: true }
  }

  onPointerDown(info: PointerInfo): ToolResult {
    if (info.button !== 0) return {}
    this.start = snapPointToGrid(info.world)
    return {}
  }

  onPointerUp(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.start) return {}
    const start = this.start
    this.start = null
    const dragged = isDrag(start, info.world)
    const element = this.buildElement(
      dragged ? this.dragBounds(start, info.world) : this.defaultBounds(start),
      ctx,
    )
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
    this.start = null
    ctx.setPreview(null)
  }

  private defaultBounds(world: Point): Rect {
    const center = snapPointToGrid(world)
    return {
      x: center.x - STICKY_DEFAULT_WIDTH / 2,
      y: center.y - STICKY_DEFAULT_HEIGHT / 2,
      width: STICKY_DEFAULT_WIDTH,
      height: STICKY_DEFAULT_HEIGHT,
    }
  }

  private dragBounds(start: Point, world: Point): Rect {
    const end = snapPointToGrid(world)
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    }
  }

  private buildElement(bounds: Rect, ctx: ToolContext): StickyElement {
    return createSticky({ ...bounds, color: this.color, style: ctx.store.getLastUsedStyle() })
  }
}

function isDrag(start: Point, world: Point): boolean {
  return Math.hypot(world.x - start.x, world.y - start.y) >= DRAG_THRESHOLD
}
