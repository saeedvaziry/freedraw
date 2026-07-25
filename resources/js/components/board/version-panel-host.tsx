import { useEffect } from 'react'
import type { UseVersionsResult } from '@/hooks/board/use-versions.js'
import { VersionPanel } from './versions/version-panel.js'

interface VersionPanelHostProps {
  versions: UseVersionsResult
  className?: string
  onClose(): void
}

export function VersionPanelHost({ versions, className, onClose }: VersionPanelHostProps) {
  const { refresh } = versions

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!versions.available) return null

  return (
    <VersionPanel
      versions={versions.versions}
      loading={versions.loading}
      error={versions.error}
      canManage={versions.canManage}
      labelDraft={versions.labelDraft}
      saving={versions.saving}
      loadingPreviewId={versions.loadingPreviewId}
      previewVersionId={versions.previewVersion?.id ?? null}
      pendingRestoreId={versions.pendingRestoreId}
      restoringId={versions.restoringId}
      className={className}
      onLabelDraftChange={versions.setLabelDraft}
      onSave={versions.saveVersion}
      onRefresh={versions.refresh}
      onPreview={versions.openPreview}
      onRequestRestore={versions.requestRestore}
      onCancelRestore={versions.cancelRestore}
      onConfirmRestore={versions.confirmRestore}
      onClose={onClose}
    />
  )
}
