import { usePage } from '@inertiajs/react'
import { useMemo, useSyncExternalStore } from 'react'
import { shallowEqual, type EditorController, type SceneStore } from '@freedraw/engine'
import { ActionsBar } from '@/components/board/ui-kit'
import { BoardUserMenu } from './board-user-menu.js'
import type { BoardActionContext } from './board-actions.js'
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

  const isAuthenticated = Boolean(usePage().props.auth?.user)

  const ctx: BoardActionContext = {
    store,
    controller,
    boardExport,
    theme,
    openImagePicker: () => {},
  }

  return (
    <ActionsBar
      ctx={ctx}
      snapGuidesEnabled={state.snapGuidesEnabled}
      canExport={state.canExport}
      compact={compact}
      userMenu={compact || isAuthenticated ? undefined : <BoardUserMenu />}
    />
  )
}
