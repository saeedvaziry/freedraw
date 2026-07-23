import { useSyncExternalStore, type ReactNode } from 'react'
import type { SceneStore, ShapeType, StickyColor, ToolId } from '@freedraw/engine'
import { Toolbar, type ToolbarLayout } from '@/components/board/ui-kit'

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

  const selectTool = (tool: ToolId): void => {
    store.setUiState({ activeTool: tool })
  }

  const selectShape = (type: ShapeType): void => {
    store.setUiState({ activeTool: 'shape', activeShapeType: type })
  }

  const selectStickyColor = (color: StickyColor): void => {
    store.setUiState({ activeTool: 'sticky', activeStickyColor: color })
  }

  return (
    <Toolbar
      layout={layout}
      diagramOpen={diagramOpen}
      trailing={trailing}
      activeTool={ui.activeTool}
      activeShapeType={ui.activeShapeType}
      activeStickyColor={ui.activeStickyColor}
      onSelectTool={selectTool}
      onSelectShape={selectShape}
      onSelectStickyColor={selectStickyColor}
      onToggleDiagram={onToggleDiagram}
    />
  )
}
