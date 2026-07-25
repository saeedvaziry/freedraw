import { Loader2, RefreshCw, Save, X } from 'lucide-react'
import type { PageVersion } from '@/lib/persistence'
import { Input } from '@/components/ui/input'
import { Button, cn, FloatingPanel, IconButton } from '@/components/board/ui-kit'
import { VersionRow } from './version-row.js'

const HEADER_ACTION_CLASS = 'size-7 rounded-md text-foreground/70 coarse:size-7'

export interface VersionPanelProps {
  versions: PageVersion[]
  loading: boolean
  error: string | null
  canManage: boolean
  labelDraft: string
  saving: boolean
  loadingPreviewId: number | null
  previewVersionId: number | null
  pendingRestoreId: number | null
  restoringId: number | null
  className?: string
  onLabelDraftChange(label: string): void
  onSave(): void
  onRefresh(): void
  onPreview(version: PageVersion): void
  onRequestRestore(version: PageVersion): void
  onCancelRestore(): void
  onConfirmRestore(version: PageVersion): void
  onClose(): void
}

export function VersionPanel({
  versions,
  loading,
  error,
  canManage,
  labelDraft,
  saving,
  loadingPreviewId,
  previewVersionId,
  pendingRestoreId,
  restoringId,
  className,
  onLabelDraftChange,
  onSave,
  onRefresh,
  onPreview,
  onRequestRestore,
  onCancelRestore,
  onConfirmRestore,
  onClose,
}: VersionPanelProps) {
  const canSave = canManage && !saving && labelDraft.trim().length > 0

  return (
    <FloatingPanel
      orientation="vertical"
      gap={false}
      className={cn(
        'pointer-events-auto max-h-[calc(100vh-6rem)] w-[22rem] max-w-[calc(100vw-1.5rem)] gap-3 p-3',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Version history</span>
        <div className="flex items-center gap-0.5">
          <IconButton
            aria-label="Refresh versions"
            title="Refresh"
            disabled={loading}
            onClick={onRefresh}
            className={HEADER_ACTION_CLASS}
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </IconButton>
          <IconButton
            aria-label="Close version history"
            onClick={onClose}
            className={HEADER_ACTION_CLASS}
          >
            <X />
          </IconButton>
        </div>
      </div>

      {canManage ? (
        <div className="flex items-center gap-2">
          <Input
            value={labelDraft}
            maxLength={120}
            spellCheck={false}
            placeholder="Name this version"
            aria-label="Version name"
            disabled={saving}
            onChange={(event) => onLabelDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSave) onSave()
            }}
            className="h-8 min-w-0 flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={onSave}
            className="shrink-0 gap-1.5"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {loading && versions.length === 0 ? (
          <p className="py-6 text-center text-xs text-foreground/60">Loading versions…</p>
        ) : null}

        {!loading && !error && versions.length === 0 ? (
          <p className="py-6 text-center text-xs text-foreground/60">
            No saved versions yet. Name the current board above to keep a point you can come back
            to.
          </p>
        ) : null}

        {versions.map((version) => (
          <VersionRow
            key={version.id}
            version={version}
            previewing={previewVersionId === version.id}
            loadingPreview={loadingPreviewId === version.id}
            canManage={canManage}
            pendingRestore={pendingRestoreId === version.id}
            restoring={restoringId === version.id}
            onPreview={onPreview}
            onRequestRestore={onRequestRestore}
            onCancelRestore={onCancelRestore}
            onConfirmRestore={onConfirmRestore}
          />
        ))}
      </div>

      <p className="border-t border-[color:var(--panel-border)] pt-2 text-[0.6875rem] leading-relaxed text-foreground/55">
        Previewing opens a read-only copy and never changes the live board. Restoring appends the
        chosen version as the newest snapshot on the server.
      </p>
    </FloatingPanel>
  )
}
