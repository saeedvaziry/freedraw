import { Link } from '@inertiajs/react'
import { Check, FileText, Pencil, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/components/board/ui-kit'
import type { PageEditMode } from '@/hooks/board/use-pages'
import type { BoardPage } from '@/types'

export interface PageRowProps {
  boardPage: BoardPage
  active: boolean
  mode: PageEditMode | null
  renameDraft: string
  busy: boolean
  /** Touch surfaces (the mobile menu) keep the row actions always visible. */
  alwaysShowActions?: boolean
  onRenameDraftChange(title: string): void
  onBeginRename(boardPage: BoardPage): void
  onSaveRename(boardPage: BoardPage): void
  onBeginDelete(boardPage: BoardPage): void
  onConfirmDelete(boardPage: BoardPage): void
  onCancel(): void
  /** Fires after a row link is clicked, so a host menu/sheet can close itself. */
  onNavigate?(): void
}

/**
 * A single page in the switcher: a link that activates the page, with inline
 * rename and delete-confirm states. Shared by the desktop pages bar and the
 * mobile menu.
 */
export function PageRow({
  boardPage,
  active,
  mode,
  renameDraft,
  busy,
  alwaysShowActions = false,
  onRenameDraftChange,
  onBeginRename,
  onSaveRename,
  onBeginDelete,
  onConfirmDelete,
  onCancel,
  onNavigate,
}: PageRowProps) {
  if (mode === 'rename') {
    return (
      <EditRow>
        <FileText className="size-4 shrink-0 text-foreground/70" />
        <Input
          autoFocus
          value={renameDraft}
          disabled={busy}
          aria-label="Page name"
          onChange={(event) => onRenameDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSaveRename(boardPage)
            if (event.key === 'Escape') onCancel()
          }}
          className="h-7 min-w-0 flex-1 border-0 bg-background px-2 text-sm shadow-none focus-visible:ring-1"
        />
        <IconButton label="Save name" disabled={busy} onClick={() => onSaveRename(boardPage)}>
          <Check />
        </IconButton>
        <IconButton label="Cancel" disabled={busy} onClick={onCancel}>
          <X />
        </IconButton>
      </EditRow>
    )
  }

  if (mode === 'delete') {
    return (
      <EditRow>
        <span className="min-w-0 flex-1 truncate px-1 text-sm">
          Delete <span className="font-medium">{boardPage.title}</span>?
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="h-7 shrink-0 rounded-md px-2 text-sm text-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onConfirmDelete(boardPage)}
          className="h-7 shrink-0 rounded-md bg-destructive px-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </EditRow>
    )
  }

  return (
    <div
      className={cn(
        'group flex h-9 items-center rounded-md transition-colors hover:bg-accent',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      <Link
        href={boardPage.url}
        prefetch
        onClick={onNavigate}
        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-2 pr-1 text-sm"
      >
        <FileText className="size-4 shrink-0 text-foreground/70" />
        <span className="min-w-0 flex-1 truncate">{boardPage.title}</span>
      </Link>
      {/* Fixed-width right slot. At rest it shows the active check, flush to the
          edge; on hover/focus the actions fade in over the same slot, so the
          check always lives on the right and the row never reflows. On touch
          (alwaysShowActions) the actions stay visible since there is no hover. */}
      <div className="relative mr-1 flex h-7 w-[3.25rem] shrink-0 items-center justify-end">
        {active ? (
          <Check
            className={cn(
              'absolute right-1.5 size-4 text-muted-foreground transition-opacity',
              alwaysShowActions
                ? 'opacity-0'
                : 'group-hover:opacity-0 group-focus-within:opacity-0',
            )}
          />
        ) : null}
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center gap-0.5 transition-opacity',
            alwaysShowActions
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          )}
        >
          <IconButton label="Rename page" onClick={() => onBeginRename(boardPage)}>
            <Pencil />
          </IconButton>
          <IconButton
            label="Delete page"
            className="text-destructive hover:text-destructive"
            onClick={() => onBeginDelete(boardPage)}
          >
            <Trash2 />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

/**
 * Wrapper for the inline rename / delete rows. Stops pointer and key events from
 * reaching an enclosing Radix menu so clicking inside an input, or typing a
 * letter, never selects a menu item or closes the menu.
 */
function EditRow({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-9 items-center gap-1 rounded-md bg-accent px-1.5"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  )
}

export function IconButton({
  label,
  children,
  className,
  ...props
}: {
  label: string
  children: ReactNode
  className?: string
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
