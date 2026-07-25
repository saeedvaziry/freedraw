import { usePage } from '@inertiajs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SceneStore } from '@freedraw/engine'
import {
  createVersionPreview,
  type VersionPreview,
} from '@/components/board/versions/version-preview.js'
import { boardToast } from '@/lib/board-toast'
import {
  createPageVersion,
  fetchPageVersion,
  fetchPageVersions,
  isCsrfExpired,
  restorePageVersion,
  VersionRequestError,
  type PageVersion,
} from '@/lib/persistence'

const EMPTY_VERSIONS: PageVersion[] = []

const CSRF_EXPIRED_MESSAGE = 'Your session expired. Refresh the page and try again.'

const RESTORED_MESSAGE =
  'Saved as the newest snapshot. Open boards keep their current canvas until they reload from the server.'

function failureMessage(error: unknown, fallback: string): string {
  if (isCsrfExpired(error)) return CSRF_EXPIRED_MESSAGE
  if (error instanceof VersionRequestError && error.status === 422 && error.detail) {
    return error.detail
  }
  return fallback
}

export interface UseVersionsResult {
  available: boolean
  canManage: boolean
  versions: PageVersion[]
  loading: boolean
  error: string | null
  labelDraft: string
  saving: boolean
  loadingPreviewId: number | null
  pendingRestoreId: number | null
  restoringId: number | null
  previewVersion: PageVersion | null
  previewStore: SceneStore | null
  setLabelDraft(label: string): void
  refresh(): void
  saveVersion(): void
  openPreview(version: PageVersion): void
  closePreview(): void
  requestRestore(version: PageVersion): void
  cancelRestore(): void
  confirmRestore(version: PageVersion): void
}

export function useVersions(): UseVersionsResult {
  const page = usePage()
  const boardPage = page.props.boardPage ?? null
  const isPublicView = page.props.boardAccess?.isPublic ?? false
  const publicId = isPublicView ? null : (boardPage?.publicId ?? null)
  const canManage = publicId !== null && boardPage?.canEdit !== false

  const [versions, setVersions] = useState<PageVersion[]>(EMPTY_VERSIONS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingPreviewId, setLoadingPreviewId] = useState<number | null>(null)
  const [pendingRestoreId, setPendingRestoreId] = useState<number | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ version: PageVersion; store: SceneStore } | null>(null)

  const previewRef = useRef<VersionPreview | null>(null)
  const previewToken = useRef(0)
  const listToken = useRef(0)

  const releasePreview = useCallback(() => {
    previewToken.current += 1
    previewRef.current?.destroy()
    previewRef.current = null
    setPreview(null)
  }, [])

  useEffect(() => {
    return () => {
      previewToken.current += 1
      listToken.current += 1
      previewRef.current?.destroy()
      previewRef.current = null
    }
  }, [])

  useEffect(() => {
    releasePreview()
    setVersions(EMPTY_VERSIONS)
    setError(null)
    setLabelDraft('')
    setPendingRestoreId(null)
  }, [publicId, releasePreview])

  const refresh = useCallback(() => {
    if (!publicId) return

    const token = (listToken.current += 1)
    setLoading(true)
    setError(null)

    void fetchPageVersions(publicId)
      .then((list) => {
        if (listToken.current !== token) return
        setVersions(list)
      })
      .catch((cause: unknown) => {
        if (listToken.current !== token) return
        setError(failureMessage(cause, 'Could not load the version history.'))
      })
      .finally(() => {
        if (listToken.current !== token) return
        setLoading(false)
      })
  }, [publicId])

  const saveVersion = useCallback(() => {
    const label = labelDraft.trim()
    if (!publicId || saving || label.length === 0) return

    setSaving(true)
    void createPageVersion(publicId, label)
      .then((created) => {
        setVersions((current) => [created, ...current])
        setLabelDraft('')
        boardToast('Version saved')
      })
      .catch((cause: unknown) => {
        boardToast(failureMessage(cause, 'Could not save this version.'), 'error')
      })
      .finally(() => setSaving(false))
  }, [labelDraft, publicId, saving])

  const openPreview = useCallback(
    (version: PageVersion) => {
      if (!publicId || loadingPreviewId !== null) return

      const token = (previewToken.current += 1)
      setLoadingPreviewId(version.id)

      void fetchPageVersion(publicId, version.id)
        .then((detail) => {
          if (previewToken.current !== token) return

          let next: VersionPreview
          try {
            next = createVersionPreview(detail.state)
          } catch (cause) {
            console.warn('Failed to read version state', cause)
            boardToast('This version could not be opened.', 'error')
            return
          }

          if (previewToken.current !== token) {
            next.destroy()
            return
          }

          previewRef.current?.destroy()
          previewRef.current = next
          setPreview({ version, store: next.store })
        })
        .catch((cause: unknown) => {
          boardToast(failureMessage(cause, 'Could not open that version.'), 'error')
        })
        .finally(() => {
          setLoadingPreviewId((current) => (current === version.id ? null : current))
        })
    },
    [loadingPreviewId, publicId],
  )

  const requestRestore = useCallback((version: PageVersion) => {
    setPendingRestoreId(version.id)
  }, [])

  const cancelRestore = useCallback(() => {
    setPendingRestoreId(null)
  }, [])

  const confirmRestore = useCallback(
    (version: PageVersion) => {
      if (!publicId || restoringId !== null) return

      setRestoringId(version.id)
      void restorePageVersion(publicId, version.id)
        .then(() => {
          setPendingRestoreId(null)
          boardToast(RESTORED_MESSAGE)
        })
        .catch((cause: unknown) => {
          boardToast(failureMessage(cause, 'Could not restore that version.'), 'error')
        })
        .finally(() => setRestoringId(null))
    },
    [publicId, restoringId],
  )

  return {
    available: publicId !== null,
    canManage,
    versions,
    loading,
    error,
    labelDraft,
    saving,
    loadingPreviewId,
    pendingRestoreId,
    restoringId,
    previewVersion: preview?.version ?? null,
    previewStore: preview?.store ?? null,
    setLabelDraft,
    refresh,
    saveVersion,
    openPreview,
    closePreview: releasePreview,
    requestRestore,
    cancelRestore,
    confirmRestore,
  }
}
