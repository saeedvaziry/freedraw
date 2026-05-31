import { useSyncExternalStore } from 'react'
import type { SceneStore, ShapeType, ToolId } from '@freedraw/engine'
import { Toolbar, type ToolKey } from '@freedraw/ui'

interface ToolbarHostProps {
  store: SceneStore
  onImageButton: () => void
}

export function ToolbarHost({ store, onImageButton }: ToolbarHostProps) {
  const ui = useSyncExternalStore(
    (cb) => store.subscribeUi(cb),
    () => store.getUiState(),
  )

  const selectTool = (tool: ToolKey): void => {
    if (tool === 'image') {
      onImageButton()
      return
    }
    store.setUiState({ activeTool: tool as ToolId })
  }

  const selectShape = (type: ShapeType): void => {
    store.setUiState({ activeTool: 'shape', activeShapeType: type })
  }

  return (
    <Toolbar
      activeTool={ui.activeTool as ToolKey}
      activeShapeType={ui.activeShapeType as ShapeType}
      onSelectTool={selectTool}
      onSelectShape={selectShape}
    />
  )
}
