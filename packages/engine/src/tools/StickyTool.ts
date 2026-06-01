import {
  createSticky,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_WIDTH,
} from '../model/factory.js'
import { snapPointToGrid } from '../geometry/grid.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

export class StickyTool implements Tool {
  readonly id = 'sticky'

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    const center = snapPointToGrid(info.world)
    const element = createSticky({
      x: center.x - STICKY_DEFAULT_WIDTH / 2,
      y: center.y - STICKY_DEFAULT_HEIGHT / 2,
      style: ctx.store.getLastUsedStyle(),
    })
    ctx.store.stopCapturing()
    ctx.store.transact((api) => api.addElement(element))
    ctx.store.setUiState({ selectedIds: new Set([element.id]), activeTool: 'select' })
    ctx.beginEdit({
      elementId: element.id,
      target: 'label',
      text: '',
      world: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      },
      style: element.style,
      align: element.style.textAlign,
      verticalAlign: 'middle',
    })
    return { scene: true, overlay: true }
  }
}
