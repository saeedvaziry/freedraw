import {
  createSticky,
  STICKY_DEFAULT_HEIGHT,
  STICKY_DEFAULT_WIDTH,
  STICKY_FILL,
  STICKY_ROUNDNESS,
  STICKY_STROKE,
} from '../model/factory.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

export class StickyTool implements Tool {
  readonly id = 'sticky'

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    const element = createSticky({
      x: info.world.x - STICKY_DEFAULT_WIDTH / 2,
      y: info.world.y - STICKY_DEFAULT_HEIGHT / 2,
      style: {
        ...ctx.store.getLastUsedStyle(),
        fill: STICKY_FILL,
        stroke: STICKY_STROKE,
        roundness: STICKY_ROUNDNESS,
        textAlign: 'center',
      },
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
      align: 'center',
      verticalAlign: 'middle',
    })
    return { scene: true, overlay: true }
  }
}
