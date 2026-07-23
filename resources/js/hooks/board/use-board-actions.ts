import { useEffect, useRef } from 'react'
import type { EditorController, SceneStore, ShapeType, ToolId } from '@freedraw/engine'
import {
  BOARD_ACTIONS,
  resolveActionScope,
  type BoardActionContext,
} from '@/components/board/board-actions.js'

interface ToolHotkey {
  tool: ToolId
  shapeType?: ShapeType
}

const TOOL_HOTKEYS: Record<string, ToolHotkey> = {
  v: { tool: 'select' },
  h: { tool: 'hand' },
  a: { tool: 'arrow' },
  b: { tool: 'freedraw' },
  t: { tool: 'text' },
  n: { tool: 'sticky' },
  i: { tool: 'image' },
  r: { tool: 'shape', shapeType: 'rect' },
  u: { tool: 'shape', shapeType: 'roundRect' },
  o: { tool: 'shape', shapeType: 'ellipse' },
  d: { tool: 'shape', shapeType: 'diamond' },
  g: { tool: 'shape', shapeType: 'triangle' },
  c: { tool: 'shape', shapeType: 'cylinder' },
  x: { tool: 'shape', shapeType: 'hexagon' },
  p: { tool: 'shape', shapeType: 'parallelogram' },
  s: { tool: 'shape', shapeType: 'star' },
  l: { tool: 'shape', shapeType: 'cloud' },
  e: { tool: 'shape', shapeType: 'heart' },
}

export function useBoardActions(ctx: BoardActionContext): void {
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (resolveActionScope(event.target) !== 'canvas') return
      const context = ctxRef.current

      for (const action of BOARD_ACTIONS) {
        if (!action.match?.(event)) continue
        if (!action.when(context)) {
          if (event.metaKey || event.ctrlKey) event.preventDefault()
          return
        }
        event.preventDefault()
        action.run(context)
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (context.readOnly) return

      const { store, controller } = context
      if (controller && isPrintableKey(event.key) && tryBeginLabelEdit(store, controller, event.key)) {
        event.preventDefault()
        return
      }

      const hotkey = TOOL_HOTKEYS[event.key.toLowerCase()]
      if (!hotkey) return
      event.preventDefault()
      if (hotkey.tool === 'image') {
        context.openImagePicker()
        return
      }
      store.setUiState({
        activeTool: hotkey.tool,
        ...(hotkey.shapeType ? { activeShapeType: hotkey.shapeType } : {}),
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

function isPrintableKey(key: string): boolean {
  return key.length === 1 && key !== ' '
}

function tryBeginLabelEdit(store: SceneStore, controller: EditorController, char: string): boolean {
  const ui = store.getUiState()
  if (ui.activeTool !== 'select') return false
  if (controller.activeEdit) return false
  if (ui.selectedIds.size !== 1) return false
  const [elementId] = ui.selectedIds
  if (!elementId) return false
  controller.beginLabelEditFromText(elementId, char)
  return true
}
