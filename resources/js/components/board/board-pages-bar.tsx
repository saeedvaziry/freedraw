import { usePage } from '@inertiajs/react'
import { ChevronsUpDown, FileText, Plus, Share2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { usePages } from '@/hooks/board/use-pages'
import { PageRow } from './page-row.js'
import { SharePageModal } from './share-page-modal.js'

/**
 * Floating page switcher anchored top-left, beside the sidebar. A single
 * trigger shows the active page; opening it reveals the one place to switch,
 * rename, add, and delete pages. Each row carries its own inline rename field
 * and delete confirmation, so the menu never hands off to a browser dialog or
 * rearranges the bar around an editing state. Renders nothing for guests.
 */
export function BoardPagesBar() {
  const user = usePage().props.auth?.user ?? null
  const [open, setOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const pages = usePages(useCallback(() => setOpen(false), []))
  const {
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
  } = pages

  // Closing the menu (outside click, Escape, page switch) abandons any in-flight
  // rename or delete confirmation so it never lingers on reopen.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (busy) return
      setOpen(next)
      if (!next) resetEditing()
    },
    [busy, resetEditing],
  )

  if (!user) return null

  const count = boardPages.length

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 min-w-0 max-w-[min(22rem,calc(100vw-10rem))] items-center gap-2 rounded-lg border bg-background/90 px-2.5 text-left text-sm shadow-sm backdrop-blur transition-colors hover:bg-accent data-[state=open]:bg-accent"
          >
            <FileText className="size-4 shrink-0 text-foreground/70" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {activePage?.title ?? 'Untitled page'}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-72 p-1.5"
          align="start"
          side="bottom"
          // Keep focus on whichever inline input we just opened instead of
          // letting Radix pull it back to the trigger.
          onCloseAutoFocus={(event) => {
            if (editing) event.preventDefault()
          }}
        >
          <DropdownMenuLabel className="px-1.5 py-1 text-xs font-normal text-muted-foreground">
            {count === 1 ? '1 page' : `${count} pages`}
          </DropdownMenuLabel>

          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto py-0.5">
            {count === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                No pages yet. Add one to get started.
              </p>
            ) : (
              boardPages.map((boardPage) => (
                <PageRow
                  key={boardPage.publicId}
                  boardPage={boardPage}
                  active={activePage?.publicId === boardPage.publicId}
                  mode={editing?.id === boardPage.publicId ? editing.mode : null}
                  renameDraft={renameDraft}
                  busy={busy}
                  onRenameDraftChange={setRenameDraft}
                  onBeginRename={beginRename}
                  onSaveRename={saveRename}
                  onBeginDelete={beginDelete}
                  onConfirmDelete={confirmDelete}
                  onCancel={resetEditing}
                  onNavigate={() => setOpen(false)}
                />
              ))
            )}
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer gap-2"
            disabled={creating}
            onSelect={(event) => {
              event.preventDefault()
              createPage()
            }}
          >
            <Plus className="size-4" />
            <span>{creating ? 'Creating…' : 'New page'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {activePage?.canShare ? (
        <button
          type="button"
          aria-label="Share page"
          title="Share page"
          onClick={() => setShareOpen(true)}
          className="flex h-9 shrink-0 items-center gap-2 rounded-lg border bg-background/90 px-2.5 text-sm shadow-sm backdrop-blur transition-colors hover:bg-accent"
        >
          <Share2 className="size-4 shrink-0 text-foreground/70" />
          <span className="font-medium">Share</span>
        </button>
      ) : null}

      {activePage ? (
        <SharePageModal boardPage={activePage} open={shareOpen} onOpenChange={setShareOpen} />
      ) : null}
    </div>
  )
}
