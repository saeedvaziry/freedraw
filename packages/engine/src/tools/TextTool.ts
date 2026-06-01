import { createText, TEXT_DEFAULT_HEIGHT, TEXT_DEFAULT_WIDTH } from '../model/factory.js'
import { snapPointToGrid } from '../geometry/grid.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

export class TextTool implements Tool {
  readonly id = 'text'

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    const center = snapPointToGrid(info.world)
    const element = createText({
      x: center.x - TEXT_DEFAULT_WIDTH / 2,
      y: center.y - TEXT_DEFAULT_HEIGHT / 2,
      style: ctx.store.getLastUsedStyle(),
    })
    ctx.store.stopCapturing()
    ctx.store.transact((api) => api.addElement(element))
    ctx.store.setUiState({ selectedIds: new Set([element.id]), activeTool: 'select' })
    ctx.beginEdit({
      elementId: element.id,
      target: 'text',
      text: '',
      world: { x: element.x, y: element.y, width: TEXT_DEFAULT_WIDTH, height: TEXT_DEFAULT_HEIGHT },
      style: element.style,
      align: element.style.textAlign,
      verticalAlign: 'middle',
    })
    return { scene: true, overlay: true }
  }
}
