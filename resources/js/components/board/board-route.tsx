import { router, usePage } from '@inertiajs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import { BoardMobileMenu } from './board-mobile-menu.js'
import { BoardPagesBar } from './board-pages-bar.js'
import { BoardSidebar } from './board-sidebar.js'
import { BottomBar } from './bottom-bar.js'
import { CanvasHost } from './canvas-host.js'
import { DiagramPanelHost } from './diagram-panel-host.js'
import { EmptyState } from './empty-state.js'
import { LinksBar } from './links-bar.js'
import { MobileBar } from './mobile-bar.js'
import { StylePanelHost } from './style-panel-host.js'
import { ZoomIndicator } from './zoom-indicator.js'
import { createBoard, type Board as CreatedBoard } from './create-board.js'
import { useBoardClipboard } from '@/hooks/board/use-board-clipboard.js'
import { useExport } from '@/hooks/board/use-export.js'
import { useKeyboard } from '@/hooks/board/use-keyboard.js'
import { useTheme } from '@/hooks/board/use-theme.js'
import type { BoardPage } from '@/types'

function destroyBoard(board: CreatedBoard): void {
  void board.sync?.flush()
  board.sync?.destroy()
  board.persistence.destroy()
}

export function BoardRoute() {
  const { auth, boardPage, currentOrganization, boardAccess } = usePage().props
  const publicView = boardAccess?.isPublic ?? false
  const [board, setBoard] = useState<{ store: SceneStore; page: BoardPage | null } | null>(null)
  // The board currently mounted on screen. We hold onto it across navigation so
  // the old canvas keeps painting while the next board hydrates in the
  // background, then swap atomically — no blank frame in between.
  const displayed = useRef<CreatedBoard | null>(null)

  useEffect(() => {
    let cancelled = false

    const adopt = (next: CreatedBoard) => {
      if (cancelled) {
        destroyBoard(next)
        return
      }
      // Replace the on-screen board only once the next one is ready, then tear
      // down the one it replaced.
      const previous = displayed.current
      displayed.current = next
      setBoard({ store: next.store, page: next.page })
      if (previous) destroyBoard(previous)
    }

    void createBoard({
      userId: auth?.user?.id ?? null,
      organizationId: currentOrganization?.id ?? null,
      initialPage: boardPage ?? null,
      publicView,
    })
      .then((result) => {
        if (cancelled) {
          if ('persistence' in result) destroyBoard(result)
          return
        }
        if ('redirectTo' in result) {
          router.visit(result.redirectTo, { replace: true })
          return
        }
        adopt(result)
      })
      .catch((error) => {
        console.warn('Failed to initialize board', error)
        void createBoard({ userId: null, organizationId: null, initialPage: null })
          .then((fallback) => {
            if (!('persistence' in fallback)) return
            adopt(fallback)
          })
          .catch((fallbackError) => {
            console.warn('Failed to initialize fallback board', fallbackError)
          })
      })

    return () => {
      cancelled = true
    }
  }, [auth?.user?.id, boardPage, currentOrganization?.id, publicView])

  // Destroy the last board only when the route itself unmounts (leaving the
  // board entirely), not on every navigation between boards.
  useEffect(() => {
    return () => {
      if (displayed.current) {
        destroyBoard(displayed.current)
        displayed.current = null
      }
    }
  }, [])

  if (!board) return <BoardLoading />
  return <Board store={board.store} readOnly={publicView} />
}

function BoardLoading() {
  return <div className="h-full w-full bg-background" />
}

interface BoardProps {
  store: SceneStore
  /** Read-only public share: pan/zoom/copy/export stay, document edits are blocked. */
  readOnly?: boolean
}

function Board({ store, readOnly = false }: BoardProps) {
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

  // Read-only public shares can still pan, zoom, copy and export; only document
  // mutation (drawing, moving, deleting, text editing) is suppressed.
  useEffect(() => {
    controller?.setReadOnly(readOnly)
  }, [controller, readOnly])

  return (
    <div className="relative h-full w-full">
      <CanvasHost store={store} onImagePicker={registerPicker} onController={setController} />
      <EmptyState store={store} />

      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 sm:hidden">
        <BoardMobileMenu />
      </div>

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
        <StylePanelHost store={store} collapsible />
      </div>
      <div className="pointer-events-none absolute top-3 bottom-3 left-3 hidden sm:block">
        <BoardSidebar />
      </div>
      <div
        className="pointer-events-none absolute top-3 hidden transition-[left] duration-200 ease-linear sm:flex"
        style={{ left: 'calc(1.25rem + var(--board-sidebar-width, 0px))' }}
      >
        <BoardPagesBar />
      </div>
      {diagramOpen ? (
        <div
          className="pointer-events-none absolute top-16 hidden justify-start transition-[left] duration-200 ease-linear sm:flex"
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
