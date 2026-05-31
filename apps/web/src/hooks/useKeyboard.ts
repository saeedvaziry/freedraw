import { useEffect } from 'react'
import type { EditorController, SceneStore, ShapeType, ToolId } from '@freedraw/engine'

interface ToolHotkey {
  tool: ToolId
  shapeType?: ShapeType
}

const TOOL_HOTKEYS: Record<string, ToolHotkey> = {
  v: { tool: 'select' },
  h: { tool: 'hand' },
  a: { tool: 'arrow' },
  t: { tool: 'text' },
  s: { tool: 'sticky' },
  r: { tool: 'shape', shapeType: 'rect' },
  o: { tool: 'shape', shapeType: 'ellipse' },
  d: { tool: 'shape', shapeType: 'diamond' },
}

export function useKeyboard(store: SceneStore, controller: EditorController | null): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && key === 'd') {
        event.preventDefault()
        store.duplicateElements(store.getUiState().selectedIds)
        return
      }
      if (mod && key === 'a') {
        event.preventDefault()
        store.setUiState({ selectedIds: new Set(store.getSnapshot().order) })
        return
      }
      if (mod && key === '0') {
        event.preventDefault()
        controller?.zoomToActualSize()
        return
      }
      if (mod && (key === '1' || key === '9')) {
        event.preventDefault()
        controller?.zoomToFit()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const ids = store.getUiState().selectedIds
        if (ids.size === 0) return
        event.preventDefault()
        store.deleteElements(ids)
        return
      }
      if (event.key === 'Escape') {
        if (store.getUiState().selectedIds.size === 0) return
        store.setUiState({ selectedIds: new Set() })
        return
      }

      if (mod || event.altKey) return
      const hotkey = TOOL_HOTKEYS[key]
      if (!hotkey) return
      event.preventDefault()
      store.setUiState({
        activeTool: hotkey.tool,
        ...(hotkey.shapeType ? { activeShapeType: hotkey.shapeType } : {}),
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store, controller])
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
