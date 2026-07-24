import { router, usePage } from '@inertiajs/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorController, type CanvasColorOverrides, type SceneStore } from '@freedraw/engine'
import { BoardProvider, type BoardContextValue } from './board-context.js'
import {
  attachViewportPersistence,
  gcOrphanedStorage,
  type AssetSource,
  type PageSync,
} from '@/lib/persistence'
import { useImageInsert } from '@/hooks/board/use-image-insert.js'
import { BoardMobileMenu } from './board-mobile-menu.js'
import { BoardPagesBar } from './board-pages-bar.js'
import { BoardSidebar } from './board-sidebar.js'
import { BottomBar } from './bottom-bar.js'
import { CanvasHost } from './canvas-host.js'
import { CommandPaletteHost } from './command-palette/command-palette-host.js'
import { ContextMenuHost } from './context-menu/context-menu-host.js'
import { DiagramPanelHost } from './diagram-panel-host.js'
import { EmptyState } from './empty-state.js'
import { LinksBar } from './links-bar.js'
import { MobileBar } from './mobile-bar.js'
import { PresentButton, PresentOverlay } from './present-mode.js'
import { SceneImportHost } from './scene-import-host.js'
import { SelectionToolbarHost } from './selection-toolbar/selection-toolbar-host.js'
import { ShortcutsSheetHost } from './shortcuts-sheet.js'
import { StylePanelHost } from './style-panel-host.js'
import { SyncStatus } from './sync-status.js'
import { ZoomIndicator } from './zoom-indicator.js'
import { createBoard, type Board as CreatedBoard } from './create-board.js'
import { useBoardClipboard } from '@/hooks/board/use-board-clipboard.js'
import { useExport } from '@/hooks/board/use-export.js'
import { useBoardActions } from '@/hooks/board/use-board-actions.js'
import { usePresentMode } from '@/hooks/board/use-present-mode.js'
import { useAppearance } from '@/hooks/use-appearance'
import type { BoardPage } from '@/types'

function destroyBoard(board: CreatedBoard): void {
  void board.sync?.flush()
  board.sync?.destroy()
  board.persistence.destroy()
}

function readCanvasColors(): CanvasColorOverrides {
  if (typeof document === 'undefined') return {}
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string) => styles.getPropertyValue(name)
  return {
    gridLine: read('--canvas-grid-line'),
    gridMajor: read('--canvas-grid-major'),
    gridBackground: read('--canvas-grid-background'),
    selectionAccent: read('--selection-accent'),
    selectionAccentSoft: read('--selection-accent-weak'),
    selectionHandle: read('--canvas-selection-handle'),
  }
}

export function BoardRoute() {
  const { auth, boardPage, livePageIds, currentOrganization, boardAccess } = usePage().props
  const publicView = boardAccess?.isPublic ?? false
  const [board, setBoard] = useState<{
    store: SceneStore
    page: BoardPage | null
    sync: PageSync | null
    assetSource: AssetSource
  } | null>(null)
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
      setBoard({
        store: next.store,
        page: next.page,
        sync: next.sync ?? null,
        assetSource: next.assetSource,
      })
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

  // Reclaim local storage from pages that no longer exist. Runs on mount and
  // whenever the page list changes (e.g. after a page is deleted).
  useEffect(() => {
    if (publicView || !auth?.user) return
    void gcOrphanedStorage(livePageIds)
  }, [publicView, auth?.user, livePageIds])

  if (!board) return <BoardLoading />
  return (
    <Board
      store={board.store}
      readOnly={publicView}
      sync={board.sync}
      assetSource={board.assetSource}
    />
  )
}

function BoardLoading() {
  return <div className="h-full w-full bg-background" />
}

interface BoardProps {
  store: SceneStore
  /** Read-only public share: pan/zoom/copy/export stay, document edits are blocked. */
  readOnly?: boolean
  sync: PageSync | null
  assetSource: AssetSource
}

function Board({ store, readOnly = false, sync, assetSource }: BoardProps) {
  const sceneRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [controller, setController] = useState<EditorController | null>(null)
  const [diagramOpen, setDiagramOpen] = useState(false)
  // The board consumes the app-wide appearance (light / dark / system) hook; the
  // canvas and export only care about the *resolved* light/dark value.
  const { resolvedAppearance: theme } = useAppearance()
  const boardExport = useExport(controller, store)
  const imageInsert = useImageInsert(controller, store, assetSource)
  useBoardActions({
    store,
    controller,
    boardExport,
    theme,
    readOnly,
    openImagePicker: imageInsert.openPicker,
  })
  useBoardClipboard(store, controller)
  const present = usePresentMode(controller, store)

  useEffect(() => attachViewportPersistence(store, assetSource), [store, assetSource])

  useEffect(() => {
    const scene = sceneRef.current
    const overlay = overlayRef.current
    if (!scene || !overlay) return

    const instance = new EditorController(store, scene, overlay, readCanvasColors())
    const cleanup = instance.mount()
    setController(instance)
    return () => {
      cleanup()
      setController(null)
    }
  }, [store])

  useEffect(() => {
    controller?.setDark(theme === 'dark')
    controller?.setColors(readCanvasColors())
  }, [controller, theme])

  // Read-only public shares can still pan, zoom, copy and export; only document
  // mutation (drawing, moving, deleting, text editing) is suppressed.
  useEffect(() => {
    controller?.setReadOnly(readOnly)
  }, [controller, readOnly])

  const context = useMemo<BoardContextValue>(
    () => ({
      store,
      controller,
      boardExport,
      theme,
      readOnly,
      scope: readOnly ? 'view' : 'edit',
      openImagePicker: imageInsert.openPicker,
      sync,
    }),
    [store, controller, boardExport, theme, readOnly, imageInsert.openPicker, sync],
  )

  return (
    <BoardProvider value={context}>
      <div
        className="relative h-full w-full"
        onDragOver={imageInsert.onDragOver}
        onDrop={imageInsert.onDrop}
      >
        <CanvasHost sceneRef={sceneRef} overlayRef={overlayRef} controller={controller} />
        {present.active ? (
          <PresentOverlay present={present} />
        ) : (
          <>
            <ContextMenuHost />
            <EmptyState />
            <CommandPaletteHost />
            <ShortcutsSheetHost />
            <SelectionToolbarHost />
            <SceneImportHost />

            <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 sm:hidden">
              <BoardMobileMenu />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-center px-3 sm:hidden">
              <MobileBar />
            </div>

            <div className="pointer-events-none absolute top-3 right-3 hidden justify-end sm:flex">
              <StylePanelHost collapsible />
            </div>
            <div className="pointer-events-none absolute top-3 bottom-3 left-3 hidden sm:block">
              <BoardSidebar />
            </div>
            <div
              className="pointer-events-none absolute top-3 hidden items-center gap-2 transition-[left] duration-200 ease-linear sm:flex"
              style={{ left: 'calc(1.25rem + var(--board-sidebar-width, 0px))' }}
            >
              <BoardPagesBar />
              <SyncStatus />
            </div>
            {diagramOpen ? (
              <div
                className="pointer-events-none absolute top-16 hidden justify-start transition-[left] duration-200 ease-linear sm:flex"
                style={{ left: 'calc(0.75rem + var(--board-sidebar-width, 0px))' }}
              >
                <DiagramPanelHost onClose={() => setDiagramOpen(false)} />
              </div>
            ) : null}
            <div
              className="pointer-events-none absolute bottom-3 hidden justify-center px-3 transition-[left] duration-200 ease-linear sm:flex"
              style={{ left: 'calc(0.75rem + var(--board-sidebar-width, 0px))', right: '0.75rem' }}
            >
              <BottomBar
                diagramOpen={diagramOpen}
                onToggleDiagram={() => setDiagramOpen((open) => !open)}
              />
            </div>
            <div className="pointer-events-none absolute right-3 bottom-3 hidden items-center gap-2 sm:flex">
              <PresentButton onEnter={present.enter} />
              <LinksBar />
              <ZoomIndicator />
            </div>
            <input
              ref={imageInsert.fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={imageInsert.onFileInputChange}
            />
          </>
        )}
      </div>
    </BoardProvider>
  )
}
