import { Eye, RotateCcw, Undo2 } from 'lucide-react'
import type { PageVersion } from '@/lib/persistence'
import { Button, FloatingPanel } from '@/components/board/ui-kit'
import { versionByline, versionTitle } from './version-format.js'

export interface VersionPreviewBannerProps {
  version: PageVersion
  canManage: boolean
  pendingRestore: boolean
  restoring: boolean
  onExit(): void
  onRequestRestore(version: PageVersion): void
  onCancelRestore(): void
  onConfirmRestore(version: PageVersion): void
}

export function VersionPreviewBanner({
  version,
  canManage,
  pendingRestore,
  restoring,
  onExit,
  onRequestRestore,
  onCancelRestore,
  onConfirmRestore,
}: VersionPreviewBannerProps) {
  return (
    <FloatingPanel
      role="status"
      className="pointer-events-auto max-w-full flex-wrap gap-2 border-[color:var(--selection-accent)] px-3 py-2 sm:flex-nowrap"
    >
      <Eye className="size-4 shrink-0 text-[color:var(--selection-accent)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          Previewing “{versionTitle(version)}”
        </p>
        <p className="truncate text-xs text-foreground/60">
          Read-only copy · {versionByline(version)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canManage && pendingRestore ? (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={onCancelRestore}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={restoring}
              onClick={() => onConfirmRestore(version)}
            >
              {restoring ? 'Restoring…' : 'Confirm restore'}
            </Button>
          </>
        ) : null}
        {canManage && !pendingRestore ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => onRequestRestore(version)}
          >
            <RotateCcw className="size-4" />
            Restore
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onExit}>
          <Undo2 className="size-4" />
          Back to live
        </Button>
      </div>
    </FloatingPanel>
  )
}
