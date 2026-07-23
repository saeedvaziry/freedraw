import { useSyncExternalStore } from 'react'
import { useBoardContext } from './board-context.js'

export function ZoomIndicator() {
  const { store } = useBoardContext()
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
