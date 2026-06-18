import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import { BoardSidebar } from './board-sidebar.js'
import { BottomBar } from './bottom-bar.js'
import { CanvasHost } from './canvas-host.js'
import { DiagramPanelHost } from './diagram-panel-host.js'
import { EmptyState } from './empty-state.js'
import { LinksBar } from './links-bar.js'
import { MobileBar } from './mobile-bar.js'
import { StylePanelHost } from './style-panel-host.js'
import { ZoomIndicator } from './zoom-indicator.js'
import { createBoard } from './create-board.js'
import { useBoardClipboard } from '@/hooks/board/use-board-clipboard.js'
import { useExport } from '@/hooks/board/use-export.js'
import { useKeyboard } from '@/hooks/board/use-keyboard.js'
import { useTheme } from '@/hooks/board/use-theme.js'

export function BoardRoute() {
  const [store, setStore] = useState<SceneStore | null>(null)

  useEffect(() => {
    let board: Awaited<ReturnType<typeof createBoard>> | null = null
    let cancelled = false
    void createBoard().then((result) => {
      if (cancelled) {
        result.persistence.destroy()
        return
      }
      board = result
      setStore(result.store)
    })
    return () => {
      cancelled = true
      board?.persistence.destroy()
    }
  }, [])

  if (!store) return <BoardLoading />
  return <Board store={store} />
}

function BoardLoading() {
  return <div className="h-full w-full bg-background" />
}

interface BoardProps {
  store: SceneStore
}

function Board({ store }: BoardProps) {
  const [controller, setController] = useState<EditorController | null>(null)
  const [diagramOpen, setDiagramOpen] = useState(false)
  const pickerRef = useRef<(() => void) | null>(null)
  const registerPicker = useCallback((openPicker: () => void) => {
    pickerRef.current = openPicker
  }, [])
  const openImagePicker = useCallback(() => {
    pickerRef.current?.()
  }, [])
  const { theme, toggle } = useTheme()
  const boardExport = useExport(controller)
  useKeyboard(store, controller, openImagePicker, boardExport)
  useBoardClipboard(store, controller)

  useEffect(() => {
    controller?.setDark(theme === 'dark')
  }, [controller, theme])

  return (
    <div className="relative h-full w-full">
      <CanvasHost store={store} onImagePicker={registerPicker} onController={setController} />
      <EmptyState store={store} />

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-center px-3 sm:hidden">
        <MobileBar
          store={store}
          controller={controller}
          boardExport={boardExport}
          theme={theme}
          onToggleTheme={toggle}
        />
      </div>

      <div className="pointer-events-none absolute top-3 right-3 hidden justify-end sm:flex">
        <StylePanelHost store={store} />
      </div>
      <div className="pointer-events-none absolute top-3 bottom-3 left-3 hidden sm:block">
        <BoardSidebar />
      </div>
      {diagramOpen ? (
        <div
          className="pointer-events-none absolute top-3 hidden justify-start transition-[left] duration-200 ease-linear sm:flex"
          style={{ left: 'calc(0.75rem + var(--board-sidebar-width, 0px))' }}
        >
          <DiagramPanelHost
            store={store}
            controller={controller}
            onClose={() => setDiagramOpen(false)}
          />
        </div>
      ) : null}
      <div
        className="pointer-events-none absolute bottom-3 hidden justify-center px-3 transition-[left] duration-200 ease-linear sm:flex"
        style={{ left: 'calc(0.75rem + var(--board-sidebar-width, 0px))', right: '0.75rem' }}
      >
        <BottomBar
          store={store}
          controller={controller}
          boardExport={boardExport}
          theme={theme}
          onToggleTheme={toggle}
          diagramOpen={diagramOpen}
          onToggleDiagram={() => setDiagramOpen((open) => !open)}
        />
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 hidden items-center gap-2 sm:flex">
        <LinksBar />
        <ZoomIndicator store={store} />
      </div>
    </div>
  )
}
