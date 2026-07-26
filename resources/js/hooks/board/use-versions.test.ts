import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneStore } from '@freedraw/engine'
import { boardToast } from '@/lib/board-toast'
import type { PageVersion } from '@/lib/persistence'

const { pageProps, persistence, preview } = vi.hoisted(() => {
  class VersionRequestError extends Error {
    constructor(
      public readonly status: number,
      public readonly detail: string | null = null,
    ) {
      super(detail ?? `Request failed with ${status}`)
      this.name = 'VersionRequestError'
    }
  }

  return {
    pageProps: { current: {} as Record<string, unknown> },
    persistence: {
      fetchPageVersions: vi.fn(),
      fetchPageVersion: vi.fn(),
      createPageVersion: vi.fn(),
      restorePageVersion: vi.fn(),
      isCsrfExpired: vi.fn(),
      VersionRequestError,
    },
    preview: { createVersionPreview: vi.fn() },
  }
})

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({ props: pageProps.current }),
}))

vi.mock('@/lib/persistence', () => persistence)

vi.mock('@/components/board/versions/version-preview.js', () => preview)

vi.mock('@/lib/board-toast', () => ({
  boardToast: vi.fn(),
}))

import { useVersions } from './use-versions.js'

const toast = vi.mocked(boardToast)

const CSRF_MESSAGE = 'Your session expired. Refresh the page and try again.'

const RESTORED_MESSAGE = 'Restored. Everyone on this page sees the reverted canvas.'

const RESTORE_UNAVAILABLE_MESSAGE =
  'The realtime service is unreachable, so nothing was changed. Try again in a moment.'

function version(id: number, label: string): PageVersion {
  return { id, label, upToSeq: id, createdAt: '2026-07-25T00:00:00Z', creator: null }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

function fakePreview(name: string) {
  return { destroy: vi.fn(), store: { name } as unknown as SceneStore }
}

function props(options: { publicId?: string | null; canEdit?: boolean; isPublic?: boolean } = {}) {
  const publicId = options.publicId === undefined ? 'abc' : options.publicId
  pageProps.current = {
    boardPage: publicId === null ? null : { publicId, canEdit: options.canEdit ?? true },
    boardAccess: { isPublic: options.isPublic ?? false },
  }
}

function setup() {
  return renderHook(() => useVersions())
}

beforeEach(() => {
  vi.clearAllMocks()
  persistence.isCsrfExpired.mockReturnValue(false)
  persistence.fetchPageVersions.mockResolvedValue([])
  props()
})

describe('useVersions availability', () => {
  it('is unavailable on a board opened through a public link', () => {
    props({ isPublic: true })

    const { result } = setup()
    act(() => {
      result.current.refresh()
    })

    expect(result.current.available).toBe(false)
    expect(result.current.canManage).toBe(false)
    expect(persistence.fetchPageVersions).not.toHaveBeenCalled()
  })

  it('is unavailable without a page', () => {
    props({ publicId: null })

    expect(setup().result.current.available).toBe(false)
  })

  it('shows the history but forbids managing it on a read-only page', () => {
    props({ canEdit: false })

    const { result } = setup()

    expect(result.current.available).toBe(true)
    expect(result.current.canManage).toBe(false)
  })
})

describe('useVersions loading the list', () => {
  it('loads the snapshots and clears the loading flag', async () => {
    persistence.fetchPageVersions.mockResolvedValue([version(2, 'Later'), version(1, 'Earlier')])

    const { result } = setup()
    await act(async () => {
      result.current.refresh()
    })

    expect(persistence.fetchPageVersions).toHaveBeenCalledWith('abc')
    expect(result.current.versions.map((item) => item.id)).toEqual([2, 1])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reports a failed load in the panel rather than a toast', async () => {
    persistence.fetchPageVersions.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    await act(async () => {
      result.current.refresh()
    })

    expect(result.current.error).toBe('Could not load the version history.')
    expect(result.current.loading).toBe(false)
    expect(toast).not.toHaveBeenCalled()
  })

  it('prefers the server detail of a rejected request', async () => {
    persistence.fetchPageVersions.mockRejectedValue(
      new persistence.VersionRequestError(422, 'Wait a minute before saving again.'),
    )

    const { result } = setup()
    await act(async () => {
      result.current.refresh()
    })

    expect(result.current.error).toBe('Wait a minute before saving again.')
  })

  it('reports an expired session instead of the generic load failure', async () => {
    persistence.isCsrfExpired.mockReturnValue(true)
    persistence.fetchPageVersions.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    await act(async () => {
      result.current.refresh()
    })

    expect(result.current.error).toBe(CSRF_MESSAGE)
  })

  it('drops a stale list once a newer refresh has started', async () => {
    const first = deferred<PageVersion[]>()
    const second = deferred<PageVersion[]>()
    persistence.fetchPageVersions.mockReturnValueOnce(first.promise).mockReturnValueOnce(
      second.promise,
    )

    const { result } = setup()
    act(() => {
      result.current.refresh()
    })
    act(() => {
      result.current.refresh()
    })
    await act(async () => {
      second.resolve([version(9, 'Newest')])
      first.resolve([version(1, 'Stale')])
    })

    expect(result.current.versions.map((item) => item.id)).toEqual([9])
  })
})

describe('useVersions saving a snapshot', () => {
  it('refuses a blank label', async () => {
    const { result } = setup()
    act(() => {
      result.current.setLabelDraft('   ')
    })
    await act(async () => {
      result.current.saveVersion()
    })

    expect(persistence.createPageVersion).not.toHaveBeenCalled()
  })

  it('puts the new snapshot on top and clears the draft', async () => {
    persistence.fetchPageVersions.mockResolvedValue([version(1, 'Earlier')])
    persistence.createPageVersion.mockResolvedValue(version(2, 'Before the rewrite'))

    const { result } = setup()
    await act(async () => {
      result.current.refresh()
    })
    act(() => {
      result.current.setLabelDraft('  Before the rewrite  ')
    })
    await act(async () => {
      result.current.saveVersion()
    })

    expect(persistence.createPageVersion).toHaveBeenCalledWith('abc', 'Before the rewrite')
    expect(result.current.versions.map((item) => item.id)).toEqual([2, 1])
    expect(result.current.labelDraft).toBe('')
    expect(result.current.saving).toBe(false)
    expect(toast).toHaveBeenCalledWith('Version saved')
  })

  it('keeps the draft and reports a failed save', async () => {
    persistence.createPageVersion.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    act(() => {
      result.current.setLabelDraft('Milestone')
    })
    await act(async () => {
      result.current.saveVersion()
    })

    expect(toast).toHaveBeenCalledWith('Could not save this version.', 'error')
    expect(result.current.labelDraft).toBe('Milestone')
    expect(result.current.saving).toBe(false)
  })

  it('ignores a second save while one is in flight', async () => {
    const pending = deferred<PageVersion>()
    persistence.createPageVersion.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.setLabelDraft('Milestone')
    })
    act(() => {
      result.current.saveVersion()
    })

    expect(result.current.saving).toBe(true)

    act(() => {
      result.current.saveVersion()
    })

    expect(persistence.createPageVersion).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(version(2, 'Milestone'))
    })
  })
})

describe('useVersions previewing', () => {
  it('opens a snapshot into its own scene store', async () => {
    const live = fakePreview('preview')
    persistence.fetchPageVersion.mockResolvedValue({ ...version(1, 'Earlier'), state: 'base64' })
    preview.createVersionPreview.mockReturnValue(live)

    const { result } = setup()
    await act(async () => {
      result.current.openPreview(version(1, 'Earlier'))
    })

    expect(persistence.fetchPageVersion).toHaveBeenCalledWith('abc', 1)
    expect(preview.createVersionPreview).toHaveBeenCalledWith('base64')
    expect(result.current.previewVersion?.id).toBe(1)
    expect(result.current.previewStore).toBe(live.store)
    expect(result.current.loadingPreviewId).toBeNull()
  })

  it('ignores a second preview while one is still loading', () => {
    persistence.fetchPageVersion.mockReturnValue(deferred().promise)

    const { result } = setup()
    act(() => {
      result.current.openPreview(version(1, 'Earlier'))
    })

    expect(result.current.loadingPreviewId).toBe(1)

    act(() => {
      result.current.openPreview(version(2, 'Later'))
    })

    expect(persistence.fetchPageVersion).toHaveBeenCalledTimes(1)
  })

  it('reports a snapshot that cannot be decoded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    persistence.fetchPageVersion.mockResolvedValue({ ...version(1, 'Earlier'), state: 'broken' })
    preview.createVersionPreview.mockImplementation(() => {
      throw new Error('unreadable')
    })

    const { result } = setup()
    await act(async () => {
      result.current.openPreview(version(1, 'Earlier'))
    })

    expect(toast).toHaveBeenCalledWith('This version could not be opened.', 'error')
    expect(result.current.previewVersion).toBeNull()
    expect(result.current.loadingPreviewId).toBeNull()
    warn.mockRestore()
  })

  it('reports a failed fetch', async () => {
    persistence.fetchPageVersion.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    await act(async () => {
      result.current.openPreview(version(1, 'Earlier'))
    })

    expect(toast).toHaveBeenCalledWith('Could not open that version.', 'error')
    expect(result.current.previewVersion).toBeNull()
  })

  it('destroys the preview when it is closed', async () => {
    const live = fakePreview('preview')
    persistence.fetchPageVersion.mockResolvedValue({ ...version(1, 'Earlier'), state: 'base64' })
    preview.createVersionPreview.mockReturnValue(live)

    const { result } = setup()
    await act(async () => {
      result.current.openPreview(version(1, 'Earlier'))
    })
    act(() => {
      result.current.closePreview()
    })

    expect(live.destroy).toHaveBeenCalledTimes(1)
    expect(result.current.previewVersion).toBeNull()
    expect(result.current.previewStore).toBeNull()
  })

  it('destroys a live preview when the panel unmounts', async () => {
    const live = fakePreview('preview')
    persistence.fetchPageVersion.mockResolvedValue({ ...version(1, 'Earlier'), state: 'base64' })
    preview.createVersionPreview.mockReturnValue(live)

    const { result, unmount } = setup()
    await act(async () => {
      result.current.openPreview(version(1, 'Earlier'))
    })
    unmount()

    expect(live.destroy).toHaveBeenCalledTimes(1)
  })
})

describe('useVersions restoring', () => {
  it('asks for confirmation before touching the server', () => {
    const { result } = setup()

    act(() => {
      result.current.requestRestore(version(1, 'Earlier'))
    })

    expect(result.current.pendingRestoreId).toBe(1)
    expect(persistence.restorePageVersion).not.toHaveBeenCalled()

    act(() => {
      result.current.cancelRestore()
    })

    expect(result.current.pendingRestoreId).toBeNull()
  })

  it('restores the snapshot, explains what happened and reloads the list', async () => {
    persistence.restorePageVersion.mockResolvedValue(version(3, 'Restored'))

    const { result } = setup()
    act(() => {
      result.current.requestRestore(version(1, 'Earlier'))
    })
    await act(async () => {
      result.current.confirmRestore(version(1, 'Earlier'))
    })

    expect(persistence.restorePageVersion).toHaveBeenCalledWith('abc', 1)
    expect(toast).toHaveBeenCalledWith(RESTORED_MESSAGE)
    expect(persistence.fetchPageVersions).toHaveBeenCalledWith('abc')
    expect(result.current.pendingRestoreId).toBeNull()
    expect(result.current.restoringId).toBeNull()
  })

  it('keeps the confirmation open and reports a failed restore', async () => {
    persistence.restorePageVersion.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    act(() => {
      result.current.requestRestore(version(1, 'Earlier'))
    })
    await act(async () => {
      result.current.confirmRestore(version(1, 'Earlier'))
    })

    expect(toast).toHaveBeenCalledWith('Could not restore that version.', 'error')
    expect(result.current.pendingRestoreId).toBe(1)
    expect(persistence.fetchPageVersions).not.toHaveBeenCalled()
  })

  it('says nothing changed when the realtime service could not apply the restore', async () => {
    persistence.restorePageVersion.mockRejectedValue(
      new persistence.VersionRequestError(503, 'the live document could not be restored'),
    )

    const { result } = setup()
    act(() => {
      result.current.requestRestore(version(1, 'Earlier'))
    })
    await act(async () => {
      result.current.confirmRestore(version(1, 'Earlier'))
    })

    expect(toast).toHaveBeenCalledWith(RESTORE_UNAVAILABLE_MESSAGE, 'error')
    expect(result.current.pendingRestoreId).toBe(1)
    expect(persistence.fetchPageVersions).not.toHaveBeenCalled()
  })

  it('ignores a second restore while one is in flight', async () => {
    const pending = deferred<PageVersion>()
    persistence.restorePageVersion.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.confirmRestore(version(1, 'Earlier'))
    })

    expect(result.current.restoringId).toBe(1)

    act(() => {
      result.current.confirmRestore(version(2, 'Later'))
    })

    expect(persistence.restorePageVersion).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(version(3, 'Restored'))
    })
  })
})
