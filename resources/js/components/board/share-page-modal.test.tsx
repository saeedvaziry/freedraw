import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

import { SharePageModal } from './share-page-modal.js'

const toast = vi.mocked(boardToast)

const writeText = vi.fn()

function boardPage(
  visibility: PageVisibility = 'private',
  permission: PagePermission = 'view',
  shareUrl: string | null = null,
): BoardPage {
  return {
    publicId: 'abc',
    organizationId: 1,
    title: 'First page',
    document: null,
    url: '/p/abc',
    visibility,
    permission,
    shareUrl,
    canShare: true,
    canEdit: true,
    updatedAt: null,
  }
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

const onOpenChange = vi.fn()

function open(page: BoardPage = boardPage(), isOpen = true) {
  return render(createElement(SharePageModal, { boardPage: page, open: isOpen, onOpenChange }))
}

function option(label: string): HTMLButtonElement {
  const found = screen.getByText(label).closest('button')
  if (!found) throw new Error(`Missing option ${label}`)
  return found as HTMLButtonElement
}

function isSelected(label: string): boolean {
  return option(label).className.includes('border-primary')
}

beforeEach(() => {
  vi.clearAllMocks()
  persistence.isCsrfExpired.mockReturnValue(false)
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

describe('SharePageModal rendering', () => {
  it('renders nothing while closed', () => {
    open(boardPage(), false)

    expect(screen.queryByText('Only me')).toBeNull()
  })

  it('names the page and lists every visibility option', () => {
    open()

    expect(screen.getByText('Share “First page”')).not.toBeNull()
    expect(screen.getByText('Only me')).not.toBeNull()
    expect(screen.getByText('Anyone in your organization')).not.toBeNull()
    expect(screen.getByText('Anyone with the link')).not.toBeNull()
  })

  it('marks the current visibility as selected', () => {
    open(boardPage('organization', 'edit'))

    expect(isSelected('Anyone in your organization')).toBe(true)
    expect(isSelected('Only me')).toBe(false)
  })

  it('hides the permission picker unless the page is shared with the organization', () => {
    open()

    expect(screen.queryByText('Permission')).toBeNull()
  })

  it('shows the permission picker for an organization share', () => {
    open(boardPage('organization', 'edit'))

    expect(screen.getByText('Permission')).not.toBeNull()
  })

  it('hides the public link while the page has no share url', () => {
    open(boardPage('public', 'view', null))

    expect(screen.queryByText('Public link')).toBeNull()
  })

  it('shows the share url of a public page', () => {
    open(boardPage('public', 'view', 'https://freedraw.test/s/xyz'))

    expect((screen.getByLabelText('Public link') as HTMLInputElement).value).toBe(
      'https://freedraw.test/s/xyz',
    )
  })
})

describe('SharePageModal visibility changes', () => {
  it('saves the picked visibility and disables the options while it saves', async () => {
    const pending = deferred<BoardPage>()
    persistence.updateRemoteShare.mockReturnValue(pending.promise)

    open()
    fireEvent.click(option('Anyone with the link'))

    expect(persistence.updateRemoteShare).toHaveBeenCalledWith('abc', {
      visibility: 'public',
      permission: 'view',
    })
    expect(option('Only me').disabled).toBe(true)

    pending.resolve(boardPage('public', 'view', 'https://freedraw.test/s/xyz'))

    await waitFor(() => {
      expect(screen.queryByText('Public link')).not.toBeNull()
    })
    expect(isSelected('Anyone with the link')).toBe(true)
    expect(option('Only me').disabled).toBe(false)
  })

  it('does not re-save the visibility that is already active', () => {
    open()

    fireEvent.click(option('Only me'))

    expect(persistence.updateRemoteShare).not.toHaveBeenCalled()
  })

  it('rolls the selection back and reports a failed save', async () => {
    persistence.updateRemoteShare.mockRejectedValue(new Error('boom'))

    open()
    fireEvent.click(option('Anyone with the link'))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Could not update sharing. Try again.', 'error')
    })
    expect(isSelected('Only me')).toBe(true)
    expect(isSelected('Anyone with the link')).toBe(false)
  })
})

describe('SharePageModal copy link', () => {
  it('copies the share url and confirms it on the button', async () => {
    open(boardPage('public', 'view', 'https://freedraw.test/s/xyz'))

    fireEvent.click(screen.getByText('Copy'))

    expect(writeText).toHaveBeenCalledWith('https://freedraw.test/s/xyz')
    await waitFor(() => {
      expect(screen.queryByText('Copied')).not.toBeNull()
    })
    expect(screen.queryByText('Copy')).toBeNull()
  })

  it('reports a rejected clipboard write and keeps the copy label', async () => {
    writeText.mockRejectedValue(new Error('denied'))

    open(boardPage('public', 'view', 'https://freedraw.test/s/xyz'))
    fireEvent.click(screen.getByText('Copy'))

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Could not copy the link.', 'error')
    })
    expect(screen.queryByText('Copied')).toBeNull()
  })
})
