import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { boardToast } from '@/lib/board-toast'
import type { BoardPage, PagePermission, PageVisibility } from '@/types'

const { persistence } = vi.hoisted(() => ({
  persistence: {
    updateRemoteShare: vi.fn(),
    isCsrfExpired: vi.fn(),
  },
}))

vi.mock('@/lib/persistence', () => persistence)

vi.mock('@/lib/board-toast', () => ({
  boardToast: vi.fn(),
}))

import { useShare } from './use-share.js'

const toast = vi.mocked(boardToast)

const CSRF_MESSAGE = 'Your session expired. Refresh the page and try again.'

const csrfFailure = { csrf: true }

const writeText = vi.fn()

function boardPage(overrides: Partial<BoardPage> = {}): BoardPage {
  return {
    publicId: 'abc',
    organizationId: 1,
    title: 'First page',
    document: null,
    url: '/p/abc',
    visibility: 'private',
    permission: 'view',
    shareUrl: null,
    canShare: true,
    canEdit: true,
    updatedAt: null,
    ...overrides,
  }
}

function shared(visibility: PageVisibility, permission: PagePermission, shareUrl: string | null) {
  return boardPage({ visibility, permission, shareUrl })
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

function setup(page: BoardPage = boardPage()) {
  return renderHook((current: BoardPage) => useShare(current), { initialProps: page })
}

beforeEach(() => {
  vi.clearAllMocks()
  persistence.isCsrfExpired.mockImplementation(
    (error: unknown) => (error as { csrf?: boolean } | null)?.csrf === true,
  )
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useShare draft state', () => {
  it('starts from the page it was given', () => {
    const { result } = setup(shared('public', 'view', 'https://freedraw.test/s/xyz'))

    expect(result.current.visibility).toBe('public')
    expect(result.current.permission).toBe('view')
    expect(result.current.shareUrl).toBe('https://freedraw.test/s/xyz')
    expect(result.current.busy).toBe(false)
    expect(result.current.copied).toBe(false)
  })

  it('re-syncs when the page underneath the dialog changes', () => {
    const { result, rerender } = setup()

    rerender(shared('organization', 'edit', null))

    expect(result.current.visibility).toBe('organization')
    expect(result.current.permission).toBe('edit')
  })
})

describe('useShare visibility', () => {
  it('applies the new visibility optimistically and keeps the server answer', async () => {
    const pending = deferred<BoardPage>()
    persistence.updateRemoteShare.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.setVisibility('public')
    })

    expect(result.current.visibility).toBe('public')
    expect(result.current.busy).toBe(true)
    expect(persistence.updateRemoteShare).toHaveBeenCalledWith('abc', {
      visibility: 'public',
      permission: 'view',
    })

    await act(async () => {
      pending.resolve(shared('public', 'view', 'https://freedraw.test/s/xyz'))
    })

    expect(result.current.shareUrl).toBe('https://freedraw.test/s/xyz')
    expect(result.current.busy).toBe(false)
  })

  it('does nothing when the visibility is already selected', () => {
    const { result } = setup()

    act(() => {
      result.current.setVisibility('private')
    })

    expect(persistence.updateRemoteShare).not.toHaveBeenCalled()
  })

  it('ignores a change while a previous one is still saving', async () => {
    const pending = deferred<BoardPage>()
    persistence.updateRemoteShare.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.setVisibility('public')
    })
    act(() => {
      result.current.setVisibility('organization')
    })

    expect(persistence.updateRemoteShare).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(shared('public', 'view', 'https://freedraw.test/s/xyz'))
    })
  })

  it('rolls back to the previous settings when the save fails', async () => {
    persistence.updateRemoteShare.mockRejectedValue(new Error('boom'))

    const { result } = setup(shared('organization', 'edit', null))
    await act(async () => {
      result.current.setVisibility('public')
    })

    expect(result.current.visibility).toBe('organization')
    expect(result.current.permission).toBe('edit')
    expect(result.current.busy).toBe(false)
    expect(toast).toHaveBeenCalledWith('Could not update sharing. Try again.', 'error')
  })

  it('reports an expired session instead of the generic failure', async () => {
    persistence.updateRemoteShare.mockRejectedValue(csrfFailure)

    const { result } = setup()
    await act(async () => {
      result.current.setVisibility('public')
    })

    expect(toast).toHaveBeenCalledWith(CSRF_MESSAGE, 'error')
  })

  it('drops the share url when the page goes private again', async () => {
    persistence.updateRemoteShare.mockResolvedValue(shared('private', 'view', null))

    const { result } = setup(shared('public', 'view', 'https://freedraw.test/s/xyz'))
    await act(async () => {
      result.current.setVisibility('private')
    })

    expect(result.current.shareUrl).toBeNull()
  })
})

describe('useShare permission', () => {
  it('saves the permission against the current visibility', async () => {
    persistence.updateRemoteShare.mockResolvedValue(shared('organization', 'edit', null))

    const { result } = setup(shared('organization', 'view', null))
    await act(async () => {
      result.current.setPermission('edit')
    })

    expect(persistence.updateRemoteShare).toHaveBeenCalledWith('abc', {
      visibility: 'organization',
      permission: 'edit',
    })
    expect(result.current.permission).toBe('edit')
  })

  it('does nothing when the permission is unchanged', () => {
    const { result } = setup(shared('organization', 'edit', null))

    act(() => {
      result.current.setPermission('edit')
    })

    expect(persistence.updateRemoteShare).not.toHaveBeenCalled()
  })
})

describe('useShare copy link', () => {
  it('does nothing without a share url', () => {
    const { result } = setup()

    act(() => {
      result.current.copyLink()
    })

    expect(writeText).not.toHaveBeenCalled()
    expect(result.current.copied).toBe(false)
  })

  it('copies the link and clears the confirmation after two seconds', async () => {
    vi.useFakeTimers()
    writeText.mockResolvedValue(undefined)

    const { result } = setup(shared('public', 'view', 'https://freedraw.test/s/xyz'))
    await act(async () => {
      result.current.copyLink()
    })

    expect(writeText).toHaveBeenCalledWith('https://freedraw.test/s/xyz')
    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.copied).toBe(false)
  })

  it('reports a rejected clipboard write', async () => {
    writeText.mockRejectedValue(new Error('denied'))

    const { result } = setup(shared('public', 'view', 'https://freedraw.test/s/xyz'))
    await act(async () => {
      result.current.copyLink()
    })

    expect(toast).toHaveBeenCalledWith('Could not copy the link.', 'error')
    expect(result.current.copied).toBe(false)
  })
})
