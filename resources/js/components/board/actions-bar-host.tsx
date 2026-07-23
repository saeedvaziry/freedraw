import { usePage } from '@inertiajs/react'
import { useMemo, useSyncExternalStore } from 'react'
import { shallowEqual, type EditorController, type SceneStore } from '@freedraw/engine'
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
  const view = useMemo(
    () =>
      store.select(
        (s) => {
          const ui = s.getUiState()
          const snapshot = s.getSnapshot()
          return {
            canUndo: s.canUndo,
            canRedo: s.canRedo,
            hasSelection: ui.selectedIds.size > 0,
            hasClipboard: ui.clipboardElementCount > 0,
            canExport: snapshot.order.length > 0,
            snapGuidesEnabled: snapshot.appState.snapGuidesEnabled,
          }
        },
        { equals: shallowEqual, channels: ['doc', 'selection', 'chrome', 'history'] },
      ),
    [store],
  )
  const state = useSyncExternalStore(view.subscribe, view.getSnapshot)
  const { exportImage, copyImage } = boardExport

  // Signed-in users get the full sidebar (org / settings / logout), so the
  // actions-bar avatar menu is only needed by guests to log in or register.
  const isAuthenticated = Boolean(usePage().props.auth?.user)

  return (
    <ActionsBar
      canUndo={state.canUndo}
      canRedo={state.canRedo}
      hasSelection={state.hasSelection}
      hasClipboard={state.hasClipboard}
      canExport={state.canExport}
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
      snapGuidesEnabled={state.snapGuidesEnabled}
      onToggleSnapGuides={() => store.setSnapGuidesEnabled(!store.getSnapshot().appState.snapGuidesEnabled)}
      compact={compact}
      userMenu={compact || isAuthenticated ? undefined : <BoardUserMenu />}
    />
  )
}
