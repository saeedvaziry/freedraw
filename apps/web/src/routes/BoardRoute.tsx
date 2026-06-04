import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import { ActionsBarHost } from '../components/ActionsBarHost.js'
import { CanvasHost } from '../components/CanvasHost.js'
import { EmptyState } from '../components/EmptyState.js'
import { LinksBar } from '../components/LinksBar.js'
import { MobileBar } from '../components/MobileBar.js'
import { StylePanelHost } from '../components/StylePanelHost.js'
import { ToolbarHost } from '../components/ToolbarHost.js'
import { ZoomIndicator } from '../components/ZoomIndicator.js'
import { createBoard } from '../board/createBoard.js'
import { useBoardClipboard } from '../hooks/useBoardClipboard.js'
import { useExport } from '../hooks/useExport.js'
import { useKeyboard } from '../hooks/useKeyboard.js'
import { useTheme } from '../hooks/useTheme.js'

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

      <div className="pointer-events-none absolute top-6 right-6 hidden justify-end sm:flex">
        <StylePanelHost store={store} />
      </div>
      <div className="pointer-events-none absolute top-6 left-6 hidden justify-start sm:flex">
        <ToolbarHost store={store} />
      </div>
      <div className="pointer-events-none absolute bottom-6 left-6 hidden justify-start sm:flex">
        <ActionsBarHost
          store={store}
          controller={controller}
          boardExport={boardExport}
          theme={theme}
          onToggleTheme={toggle}
        />
      </div>
      <div className="pointer-events-none absolute right-6 bottom-6 hidden items-center gap-2 sm:flex">
        <LinksBar />
        <ZoomIndicator store={store} />
      </div>
    </div>
  )
}
