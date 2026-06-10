import { useSyncExternalStore } from 'react'
import type { SceneStore, ShapeType, StickyColor, ToolId } from '@freedraw/engine'
import { Toolbar, type StickyColorKey, type ToolbarLayout, type ToolKey } from '@freedraw/ui'

interface ToolbarHostProps {
  store: SceneStore
  layout?: ToolbarLayout
  diagramOpen?: boolean
  onToggleDiagram?(): void
}

export function ToolbarHost({ store, layout, diagramOpen, onToggleDiagram }: ToolbarHostProps) {
  const ui = useSyncExternalStore(
    (cb) => store.subscribeUi(cb),
    () => store.getUiState(),
  )

  const selectTool = (tool: ToolKey): void => {
    store.setUiState({ activeTool: tool as ToolId })
  }

  const selectShape = (type: ShapeType): void => {
    store.setUiState({ activeTool: 'shape', activeShapeType: type })
  }

  const selectStickyColor = (color: StickyColorKey): void => {
    store.setUiState({ activeTool: 'sticky', activeStickyColor: color as StickyColor })
  }

  return (
    <Toolbar
      layout={layout}
      diagramOpen={diagramOpen}
      activeTool={ui.activeTool as ToolKey}
      activeShapeType={ui.activeShapeType as ShapeType}
      activeStickyColor={ui.activeStickyColor as StickyColorKey}
      onSelectTool={selectTool}
      onSelectShape={selectShape}
      onSelectStickyColor={selectStickyColor}
      onToggleDiagram={onToggleDiagram}
    />
  )
}
