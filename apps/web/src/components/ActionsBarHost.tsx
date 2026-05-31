import { useSyncExternalStore } from 'react'
import type { SceneStore } from '@freedraw/engine'
import { ActionsBar } from '@freedraw/ui'

interface ActionsBarHostProps {
  store: SceneStore
}

export function ActionsBarHost({ store }: ActionsBarHostProps) {
  const history = useSyncExternalStore(
    (cb) => store.subscribeHistory(cb),
    () => historySnapshot(store),
  )
  const ui = useSyncExternalStore(
    (cb) => store.subscribeUi(cb),
    () => store.getUiState(),
  )

  return (
    <ActionsBar
      canUndo={history.canUndo}
      canRedo={history.canRedo}
      hasSelection={ui.selectedIds.size > 0}
      onUndo={() => store.undo()}
      onRedo={() => store.redo()}
      onDelete={() => store.deleteElements(store.getUiState().selectedIds)}
      onDuplicate={() => store.duplicateElements(store.getUiState().selectedIds)}
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
