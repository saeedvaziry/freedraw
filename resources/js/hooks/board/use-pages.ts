import { router, usePage } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/board/ui-kit'
import { createRemotePage, deleteRemotePage, updateRemotePage } from '@/lib/persistence'
import type { BoardPage } from '@/types'

const EMPTY_BOARD_PAGES: BoardPage[] = []

export type PageEditMode = 'rename' | 'delete'

export interface UsePagesResult {
  boardPages: BoardPage[]
  activePage: BoardPage | null
  /** The row currently mid-action (rename/delete), if any. */
  editing: { id: string; mode: PageEditMode } | null
  renameDraft: string
  busy: boolean
  creating: boolean
  setRenameDraft(title: string): void
  resetEditing(): void
  createPage(): void
  beginRename(boardPage: BoardPage): void
  beginDelete(boardPage: BoardPage): void
  saveRename(boardPage: BoardPage): void
  confirmDelete(boardPage: BoardPage): void
}

/**
 * Owns the board's page list and the create / rename / delete operations shared
 * by the desktop pages bar and the mobile menu. Keeps an optimistic local copy
 * of the pages so rename/delete reflect immediately, surfaces failures through
 * the toast, and runs `onNavigate` right before any navigation so the host
 * (dropdown, sheet) can close itself first.
 */
export function usePages(onNavigate?: () => void): UsePagesResult {
  const page = usePage()
  const { toast } = useToast()
  const currentBoardPage = page.props.boardPage ?? null
  const propBoardPages = page.props.boardPages ?? EMPTY_BOARD_PAGES

  const [boardPages, setBoardPages] = useState<BoardPage[]>(propBoardPages)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<{ id: string; mode: PageEditMode } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setBoardPages(propBoardPages)
  }, [propBoardPages])

  const activePage = useMemo(
    () =>
      currentBoardPage
        ? (boardPages.find((boardPage) => boardPage.publicId === currentBoardPage.publicId) ??
          currentBoardPage)
        : null,
    [boardPages, currentBoardPage],
  )

  const resetEditing = useCallback(() => {
    setEditing(null)
    setRenameDraft('')
  }, [])

  const createPage = useCallback(() => {
    if (creating) return
    setCreating(true)
    void createRemotePage({ title: 'Untitled page' })
      .then((created) => {
        onNavigate?.()
        router.visit(created.url)
      })
      .catch(() => toast('Could not create the page. Try again.', 'error'))
      .finally(() => setCreating(false))
  }, [creating, onNavigate, toast])

  const beginRename = useCallback((boardPage: BoardPage) => {
    setEditing({ id: boardPage.publicId, mode: 'rename' })
    setRenameDraft(boardPage.title)
  }, [])

  const beginDelete = useCallback((boardPage: BoardPage) => {
    setEditing({ id: boardPage.publicId, mode: 'delete' })
  }, [])

  const saveRename = useCallback(
    (boardPage: BoardPage) => {
      if (busy) return
      const title = renameDraft.trim()
      if (!title || title === boardPage.title) {
        resetEditing()
        return
      }
      setBusy(true)
      void updateRemotePage(boardPage.publicId, { title })
        .then((updated) => {
          setBoardPages((pages) =>
            pages.map((existing) =>
              existing.publicId === updated.publicId
                ? { ...existing, title: updated.title, url: updated.url, updatedAt: updated.updatedAt }
                : existing,
            ),
          )
          resetEditing()
        })
        .catch(() => toast('Could not rename the page. Try again.', 'error'))
        .finally(() => setBusy(false))
    },
    [busy, renameDraft, resetEditing, toast],
  )

  const confirmDelete = useCallback(
    (boardPage: BoardPage) => {
      if (busy) return
      setBusy(true)
      void deleteRemotePage(boardPage.publicId)
        .then((result) => {
          if (activePage?.publicId === boardPage.publicId) {
            onNavigate?.()
            router.visit(result.redirectUrl, { replace: true })
            return
          }
          setBoardPages((pages) =>
            pages.filter((existing) => existing.publicId !== boardPage.publicId),
          )
          resetEditing()
        })
        .catch(() => toast('Could not delete the page. Try again.', 'error'))
        .finally(() => setBusy(false))
    },
    [activePage?.publicId, busy, onNavigate, resetEditing, toast],
  )

  return {
    boardPages,
    activePage,
    editing,
    renameDraft,
    busy,
    creating,
    setRenameDraft,
    resetEditing,
    createPage,
    beginRename,
    beginDelete,
    saveRename,
    confirmDelete,
  }
}
