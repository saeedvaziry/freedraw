import { usePage } from '@inertiajs/react'
import { useSyncExternalStore } from 'react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import { ActionsBar } from '@/components/board/ui-kit'
import { BoardUserMenu } from './board-user-menu.js'
import type { BoardExport } from '@/hooks/board/use-export.js'

interface ActionsBarHostProps {
  store: SceneStore
  controller: EditorController | null
  boardExport: BoardExport
  theme: 'light' | 'dark'
  compact?: boolean
}

export function ActionsBarHost({
  store,
  controller,
  boardExport,
  theme,
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

  // Signed-in users get the full sidebar (org / settings / logout), so the
  // actions-bar avatar menu is only needed by guests to log in or register.
  const isAuthenticated = Boolean(usePage().props.auth?.user)

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
      snapGuidesEnabled={snapshot.appState.snapGuidesEnabled}
      onToggleSnapGuides={() => store.setSnapGuidesEnabled(!store.getSnapshot().appState.snapGuidesEnabled)}
      compact={compact}
      userMenu={compact || isAuthenticated ? undefined : <BoardUserMenu />}
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
