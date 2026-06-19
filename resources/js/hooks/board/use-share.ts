import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/board/ui-kit'
import { isCsrfExpired, updateRemoteShare } from '@/lib/persistence'
import type { BoardPage, PagePermission, PageVisibility } from '@/types'

const CSRF_EXPIRED_MESSAGE = 'Your session expired. Refresh the page and try again.'

function failureMessage(error: unknown, fallback: string): string {
  return isCsrfExpired(error) ? CSRF_EXPIRED_MESSAGE : fallback
}

export interface UseShareResult {
  visibility: PageVisibility
  permission: PagePermission
  shareUrl: string | null
  busy: boolean
  copied: boolean
  setVisibility(visibility: PageVisibility): void
  setPermission(permission: PagePermission): void
  copyLink(): void
}

/**
 * Owns the share dialog's draft state for a single page and persists changes to
 * the server. Visibility and permission are applied immediately on change so the
 * dialog reads like a settings panel rather than a form with a submit button.
 * State is kept locally so toggling options never reloads the Inertia page,
 * which would tear down and rebuild the board canvas behind the dialog.
 */
export function useShare(boardPage: BoardPage): UseShareResult {
  const { toast } = useToast()
  const [visibility, setVisibilityState] = useState<PageVisibility>(boardPage.visibility)
  const [permission, setPermissionState] = useState<PagePermission>(boardPage.permission)
  const [shareUrl, setShareUrl] = useState<string | null>(boardPage.shareUrl)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Keep the draft in sync when the active page changes underneath the dialog.
  useEffect(() => {
    setVisibilityState(boardPage.visibility)
    setPermissionState(boardPage.permission)
    setShareUrl(boardPage.shareUrl)
  }, [boardPage.publicId, boardPage.visibility, boardPage.permission, boardPage.shareUrl])

  const apply = useCallback(
    (nextVisibility: PageVisibility, nextPermission: PagePermission) => {
      const previous = { visibility, permission, shareUrl }
      setVisibilityState(nextVisibility)
      setPermissionState(nextPermission)
      setBusy(true)

      void updateRemoteShare(boardPage.publicId, {
        visibility: nextVisibility,
        permission: nextPermission,
      })
        .then((updated) => {
          setVisibilityState(updated.visibility)
          setPermissionState(updated.permission)
          setShareUrl(updated.shareUrl)
        })
        .catch((error) => {
          setVisibilityState(previous.visibility)
          setPermissionState(previous.permission)
          setShareUrl(previous.shareUrl)
          toast(failureMessage(error, 'Could not update sharing. Try again.'), 'error')
        })
        .finally(() => setBusy(false))
    },
    [boardPage.publicId, permission, shareUrl, toast, visibility],
  )

  const setVisibility = useCallback(
    (next: PageVisibility) => {
      if (next === visibility || busy) return
      apply(next, permission)
    },
    [apply, busy, permission, visibility],
  )

  const setPermission = useCallback(
    (next: PagePermission) => {
      if (next === permission || busy) return
      apply(visibility, next)
    },
    [apply, busy, permission, visibility],
  )

  const copyLink = useCallback(() => {
    if (!shareUrl) return
    void navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast('Could not copy the link.', 'error'))
  }, [shareUrl, toast])

  return {
    visibility,
    permission,
    shareUrl,
    busy,
    copied,
    setVisibility,
    setPermission,
    copyLink,
  }
}
