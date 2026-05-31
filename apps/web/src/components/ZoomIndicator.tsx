import { useSyncExternalStore } from 'react'
import type { SceneStore } from '@freedraw/engine'

interface ZoomIndicatorProps {
  store: SceneStore
}

export function ZoomIndicator({ store }: ZoomIndicatorProps) {
  const zoom = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot().appState.camera.zoom,
  )

  return (
    <div className="pointer-events-auto rounded-md border bg-background/90 px-3 py-1.5 text-sm tabular-nums shadow-sm backdrop-blur">
      {Math.round(zoom * 100)}%
    </div>
  )
}
