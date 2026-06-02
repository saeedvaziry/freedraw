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
  x: { tool: 'text' },
  n: { tool: 'sticky' },
  i: { tool: 'image' },
  r: { tool: 'shape', shapeType: 'rect' },
  u: { tool: 'shape', shapeType: 'roundRect' },
  o: { tool: 'shape', shapeType: 'ellipse' },
  d: { tool: 'shape', shapeType: 'diamond' },
  t: { tool: 'shape', shapeType: 'triangle' },
  c: { tool: 'shape', shapeType: 'cylinder' },
  g: { tool: 'shape', shapeType: 'hexagon' },
  p: { tool: 'shape', shapeType: 'parallelogram' },
  s: { tool: 'shape', shapeType: 'star' },
  l: { tool: 'shape', shapeType: 'cloud' },
  e: { tool: 'shape', shapeType: 'heart' },
}

export function useKeyboard(
  store: SceneStore,
  controller: EditorController | null,
  onImageButton: () => void,
): void {
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
        const selectedIds = store.getUiState().selectedIds
        if (selectedIds.size === 0 && store.getUiState().activeTool === 'select') return
        event.preventDefault()
        store.setUiState({ selectedIds: new Set(), activeTool: 'select' })
        return
      }

      if (mod || event.altKey) return
      const hotkey = TOOL_HOTKEYS[key]
      if (!hotkey) return
      event.preventDefault()
      if (hotkey.tool === 'image') {
        onImageButton()
        return
      }
      store.setUiState({
        activeTool: hotkey.tool,
        ...(hotkey.shapeType ? { activeShapeType: hotkey.shapeType } : {}),
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store, controller, onImageButton])
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
