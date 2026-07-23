import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { shallowEqual, type SceneStore, type ShapeType, type StickyColor, type ToolId } from '@freedraw/engine'
import { Toolbar, type ToolbarLayout } from '@/components/board/ui-kit'

interface ToolbarHostProps {
  store: SceneStore
  layout?: ToolbarLayout
  diagramOpen?: boolean
  trailing?: ReactNode
  onToggleDiagram?(): void
}

export function ToolbarHost({ store, layout, diagramOpen, trailing, onToggleDiagram }: ToolbarHostProps) {
  const chrome = useMemo(
    () =>
      store.select(
        (s) => {
          const state = s.getUiState()
          return {
            activeTool: state.activeTool,
            activeShapeType: state.activeShapeType,
            activeStickyColor: state.activeStickyColor,
            toolLock: state.toolLock,
          }
        },
        { equals: shallowEqual, channels: ['chrome'] },
      ),
    [store],
  )
  const ui = useSyncExternalStore(chrome.subscribe, chrome.getSnapshot)

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
      toolLock={ui.toolLock}
      onSelectTool={selectTool}
      onSelectShape={selectShape}
      onSelectStickyColor={selectStickyColor}
      onToggleToolLock={() => store.setUiState({ toolLock: !store.getUiState().toolLock })}
      onToggleDiagram={onToggleDiagram}
    />
  )
}
