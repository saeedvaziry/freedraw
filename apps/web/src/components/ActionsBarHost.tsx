import { useSyncExternalStore } from 'react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import { ActionsBar } from '@freedraw/ui'
import type { BoardExport } from '../hooks/useExport.js'

interface ActionsBarHostProps {
  store: SceneStore
  controller: EditorController | null
  boardExport: BoardExport
  theme: 'light' | 'dark'
  onToggleTheme(): void
  compact?: boolean
}

export function ActionsBarHost({
  store,
  controller,
  boardExport,
  theme,
  onToggleTheme,
  compact,
}: ActionsBarHostProps) {
  const history = useSyncExternalStore(
    (cb) => store.subscribeHistory(cb),
    () => historySnapshot(store),
  )
  const ui = useSyncExternalStore(
    (cb) => store.subscribeUi(cb),
    () => store.getUiState(),
  )
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot(),
  )
  const { exportImage, copyImage } = boardExport

  return (
    <ActionsBar
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      hasSelection={ui.selectedIds.size > 0}
      hasClipboard={ui.clipboardElementCount > 0}
      canExport={snapshot.order.length > 0}
      onUndo={() => store.undo()}
      onRedo={() => store.redo()}
      onDelete={() => store.deleteElements(store.getUiState().selectedIds)}
      onDuplicate={() => store.duplicateElements(store.getUiState().selectedIds)}
      onCopy={() => store.copyElements(store.getUiState().selectedIds)}
      onCut={() => store.cutElements(store.getUiState().selectedIds)}
      onPaste={() => store.pasteElements({ target: controller?.cursorWorldPoint })}
      onExport={(format, transparent, dark) => void exportImage(format, transparent, dark)}
      onCopyToClipboard={() => void copyImage()}
      theme={theme}
      onToggleTheme={onToggleTheme}
      compact={compact}
    />
  )
}

const cache = new WeakMap<SceneStore, { canUndo: boolean; canRedo: boolean }>()

function historySnapshot(store: SceneStore): { canUndo: boolean; canRedo: boolean } {
  const previous = cache.get(store)
  if (previous && previous.canUndo === store.canUndo && previous.canRedo === store.canRedo) {
    return previous
  }
  const next = { canUndo: store.canUndo, canRedo: store.canRedo }
  cache.set(store, next)
  return next
}
