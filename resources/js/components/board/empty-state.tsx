import { useSyncExternalStore } from 'react'
import type { SceneStore } from '@freedraw/engine'

interface EmptyStateProps {
  store: SceneStore
}

export function EmptyState({ store }: EmptyStateProps) {
  const isEmpty = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot().order.length === 0,
  )

  if (!isEmpty) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <p className="text-lg font-medium">Your board is empty</p>
        <p className="mt-1 text-sm">Pick a tool below to start drawing</p>
      </div>
    </div>
  )
}
