import { useSyncExternalStore, type ReactNode } from 'react'
import type { SceneStore, ShapeType, StickyColor, ToolId } from '@freedraw/engine'
import { Toolbar, type StickyColorKey, type ToolbarLayout, type ToolKey } from '@/components/board/ui-kit'

interface ToolbarHostProps {
  store: SceneStore
  layout?: ToolbarLayout
  diagramOpen?: boolean
  trailing?: ReactNode
  onToggleDiagram?(): void
}

export function ToolbarHost({ store, layout, diagramOpen, trailing, onToggleDiagram }: ToolbarHostProps) {
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
      trailing={trailing}
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
