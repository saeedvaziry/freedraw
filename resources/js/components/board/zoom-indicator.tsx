import { useSyncExternalStore } from 'react'
import { FloatingPanel } from '@/components/board/ui-kit'
import { useBoardContext } from './board-context.js'

export function ZoomIndicator() {
  const { store } = useBoardContext()
  const zoom = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot().appState.camera.zoom,
  )

  return (
    <FloatingPanel
      padding={false}
      gap={false}
      className="pointer-events-auto h-10 px-3 text-sm tabular-nums"
    >
      {Math.round(zoom * 100)}%
    </FloatingPanel>
  )
}
