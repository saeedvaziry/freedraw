import { Eye, History, Loader2, RotateCcw, Tag } from 'lucide-react'
import type { PageVersion } from '@/lib/persistence'
import { cn, IconButton } from '@/components/board/ui-kit'
import { isNamedVersion, versionByline, versionTitle } from './version-format.js'

const ROW_ACTION_CLASS =
  'size-7 coarse:size-7 rounded-md text-foreground/70 hover:bg-background hover:text-foreground'

export interface VersionRowProps {
  version: PageVersion
  previewing: boolean
  loadingPreview: boolean
  canManage: boolean
  pendingRestore: boolean
  restoring: boolean
  onPreview(version: PageVersion): void
  onRequestRestore(version: PageVersion): void
  onCancelRestore(): void
  onConfirmRestore(version: PageVersion): void
}

export function VersionRow({
  version,
  previewing,
  loadingPreview,
  canManage,
  pendingRestore,
  restoring,
  onPreview,
  onRequestRestore,
  onCancelRestore,
  onConfirmRestore,
}: VersionRowProps) {
  const named = isNamedVersion(version)
  const Icon = named ? Tag : History

  if (pendingRestore) {
    return (
      <div className="flex flex-col gap-2 rounded-md bg-accent p-2">
        <p className="text-xs text-foreground/80">
          Restore <span className="font-medium">{versionTitle(version)}</span>? It is saved as the
          newest snapshot; the canvas here does not change until the board reloads from the server.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={restoring}
            onClick={onCancelRestore}
            className="h-7 shrink-0 rounded-md px-2 text-xs text-foreground/70 transition-colors hover:bg-background hover:text-foreground coarse:h-9 disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={restoring}
            onClick={() => onConfirmRestore(version)}
            className="h-7 shrink-0 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 coarse:h-9 disabled:pointer-events-none disabled:opacity-50"
          >
            {restoring ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent',
        previewing && 'bg-accent text-accent-foreground',
      )}
    >
      <Icon
        className={cn(
          'size-4 shrink-0',
          named ? 'text-[color:var(--selection-accent)]' : 'text-foreground/50',
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            named ? 'font-medium text-foreground' : 'text-foreground/70 italic',
          )}
        >
          {versionTitle(version)}
        </p>
        <p className="truncate text-xs text-foreground/60">{versionByline(version)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {previewing ? (
          <span className="rounded-full bg-[var(--selection-accent-weak)] px-2 py-0.5 text-[0.6875rem] font-medium text-[color:var(--selection-accent)]">
            Previewing
          </span>
        ) : null}
        <IconButton
          aria-label={`Preview ${versionTitle(version)}`}
          title="Preview this version"
          disabled={loadingPreview}
          className={ROW_ACTION_CLASS}
          onClick={() => onPreview(version)}
        >
          {loadingPreview ? <Loader2 className="animate-spin" /> : <Eye />}
        </IconButton>
        {canManage ? (
          <IconButton
            aria-label={`Restore ${versionTitle(version)}`}
            title="Restore this version"
            className={ROW_ACTION_CLASS}
            onClick={() => onRequestRestore(version)}
          >
            <RotateCcw />
          </IconButton>
        ) : null}
      </div>
    </div>
  )
}
