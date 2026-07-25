import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { builtinTemplates, type Stencil } from '@freedraw/engine'
import { boardToast } from '@/lib/board-toast'
import type { BoardPage } from '@/types'

const { pageProps, routerMock, persistence } = vi.hoisted(() => ({
  pageProps: { current: {} as Record<string, unknown> },
  routerMock: { visit: vi.fn() },
  persistence: {
    createRemotePage: vi.fn(),
    updateRemotePage: vi.fn(),
    deleteRemotePage: vi.fn(),
    encodeDocAsBase64: vi.fn(),
    isCsrfExpired: vi.fn(),
  },
}))

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({ props: pageProps.current }),
  router: routerMock,
}))

vi.mock('@/lib/persistence', () => persistence)

vi.mock('@/lib/board-toast', () => ({
  boardToast: vi.fn(),
}))

import { usePages } from './use-pages.js'

const toast = vi.mocked(boardToast)

const CSRF_MESSAGE = 'Your session expired. Refresh the page and try again.'

const csrfFailure = { csrf: true }

function boardPage(publicId: string, title: string): BoardPage {
  return {
    publicId,
    organizationId: 1,
    title,
    document: null,
    url: `/p/${publicId}`,
    visibility: 'private',
    permission: 'edit',
    shareUrl: null,
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

function props(current: BoardPage | null, list: BoardPage[]): void {
  pageProps.current = { boardPage: current, boardPages: list }
}

const onNavigate = vi.fn()

function setup() {
  return renderHook(() => usePages(onNavigate))
}

beforeEach(() => {
  vi.clearAllMocks()
  persistence.encodeDocAsBase64.mockImplementation(() => 'encoded-document')
  persistence.isCsrfExpired.mockImplementation(
    (error: unknown) => (error as { csrf?: boolean } | null)?.csrf === true,
  )
  props(boardPage('abc', 'First page'), [boardPage('abc', 'First page'), boardPage('def', 'Second page')])
})

describe('usePages page list', () => {
  it('exposes the pages shared by inertia', () => {
    const { result } = setup()

    expect(result.current.boardPages.map((page) => page.publicId)).toEqual(['abc', 'def'])
    expect(result.current.editing).toBeNull()
    expect(result.current.busy).toBe(false)
    expect(result.current.creating).toBe(false)
  })

  it('prefers the local copy of the active page over the shared prop', () => {
    props(boardPage('abc', 'Stale title'), [boardPage('abc', 'Fresh title')])

    const { result } = setup()

    expect(result.current.activePage?.title).toBe('Fresh title')
  })

  it('falls back to the shared prop when the active page is missing from the list', () => {
    props(boardPage('ghi', 'Only prop'), [boardPage('abc', 'First page')])

    const { result } = setup()

    expect(result.current.activePage?.publicId).toBe('ghi')
  })

  it('has no active page on a board without one', () => {
    props(null, [])

    const { result } = setup()

    expect(result.current.activePage).toBeNull()
    expect(result.current.boardPages).toEqual([])
  })
})

describe('usePages create', () => {
  it('creates an untitled page, closes the host and visits it', async () => {
    persistence.createRemotePage.mockResolvedValue(boardPage('new', 'Untitled page'))

    const { result } = setup()
    await act(async () => {
      result.current.createPage()
    })

    expect(persistence.createRemotePage).toHaveBeenCalledWith({ title: 'Untitled page' })
    expect(routerMock.visit).toHaveBeenCalledWith('/p/new')
    expect(onNavigate.mock.invocationCallOrder[0]).toBeLessThan(
      routerMock.visit.mock.invocationCallOrder[0],
    )
    expect(result.current.creating).toBe(false)
  })

  it('ignores a second create while one is still in flight', async () => {
    const pending = deferred<BoardPage>()
    persistence.createRemotePage.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.createPage()
    })

    expect(result.current.creating).toBe(true)

    act(() => {
      result.current.createPage()
    })

    expect(persistence.createRemotePage).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(boardPage('new', 'Untitled page'))
    })

    expect(result.current.creating).toBe(false)
  })

  it('reports a failed create and stays on the page', async () => {
    persistence.createRemotePage.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    await act(async () => {
      result.current.createPage()
    })

    expect(toast).toHaveBeenCalledWith('Could not create the page. Try again.', 'error')
    expect(routerMock.visit).not.toHaveBeenCalled()
    expect(result.current.creating).toBe(false)
  })

  it('reports an expired session instead of the generic create failure', async () => {
    persistence.createRemotePage.mockRejectedValue(csrfFailure)

    const { result } = setup()
    await act(async () => {
      result.current.createPage()
    })

    expect(toast).toHaveBeenCalledWith(CSRF_MESSAGE, 'error')
  })
})

describe('usePages create from template', () => {
  function template(name: string): Stencil {
    return { ...builtinTemplates[0], name }
  }

  it('seeds a document from the template and names the page after it', async () => {
    persistence.createRemotePage.mockResolvedValue(boardPage('tpl', 'Flow chart'))
    let seededElements = 0
    persistence.encodeDocAsBase64.mockImplementation((doc: { getMap(name: string): { size: number } }) => {
      seededElements = doc.getMap('elements').size
      return 'encoded-document'
    })

    const { result } = setup()
    await act(async () => {
      result.current.createFromTemplate(template('Flow chart'))
    })

    expect(seededElements).toBe(builtinTemplates[0].payload.elements.length)
    expect(seededElements).toBeGreaterThan(0)
    expect(persistence.createRemotePage).toHaveBeenCalledWith({
      title: 'Flow chart',
      document: 'encoded-document',
    })
    expect(routerMock.visit).toHaveBeenCalledWith('/p/tpl')
  })

  it('falls back to the default title for an unnamed template', async () => {
    persistence.createRemotePage.mockResolvedValue(boardPage('tpl', 'Untitled page'))

    const { result } = setup()
    await act(async () => {
      result.current.createFromTemplate(template(''))
    })

    expect(persistence.createRemotePage).toHaveBeenCalledWith({
      title: 'Untitled page',
      document: 'encoded-document',
    })
  })

  it('ignores a template create while another create is running', async () => {
    const pending = deferred<BoardPage>()
    persistence.createRemotePage.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.createPage()
    })
    act(() => {
      result.current.createFromTemplate(template('Flow chart'))
    })

    expect(persistence.createRemotePage).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(boardPage('new', 'Untitled page'))
    })
  })

  it('reports a failed template create', async () => {
    persistence.createRemotePage.mockRejectedValue(csrfFailure)

    const { result } = setup()
    await act(async () => {
      result.current.createFromTemplate(template('Flow chart'))
    })

    expect(toast).toHaveBeenCalledWith(CSRF_MESSAGE, 'error')
    expect(result.current.creating).toBe(false)
  })
})

describe('usePages rename', () => {
  it('opens the row with the current title as the draft', () => {
    const { result } = setup()

    act(() => {
      result.current.beginRename(boardPage('abc', 'First page'))
    })

    expect(result.current.editing).toEqual({ id: 'abc', mode: 'rename' })
    expect(result.current.renameDraft).toBe('First page')
  })

  it('closes the row without a request when the title did not change', async () => {
    const { result } = setup()

    act(() => {
      result.current.beginRename(boardPage('abc', 'First page'))
    })
    await act(async () => {
      result.current.saveRename(boardPage('abc', 'First page'))
    })

    expect(persistence.updateRemotePage).not.toHaveBeenCalled()
    expect(result.current.editing).toBeNull()
    expect(result.current.renameDraft).toBe('')
  })

  it('closes the row without a request for a blank title', async () => {
    const { result } = setup()

    act(() => {
      result.current.beginRename(boardPage('abc', 'First page'))
      result.current.setRenameDraft('   ')
    })
    await act(async () => {
      result.current.saveRename(boardPage('abc', 'First page'))
    })

    expect(persistence.updateRemotePage).not.toHaveBeenCalled()
    expect(result.current.editing).toBeNull()
  })

  it('writes the saved title into the local list and closes the row', async () => {
    persistence.updateRemotePage.mockResolvedValue({
      ...boardPage('abc', 'Renamed'),
      updatedAt: '2026-07-25T00:00:00Z',
    })

    const { result } = setup()
    act(() => {
      result.current.beginRename(boardPage('abc', 'First page'))
      result.current.setRenameDraft('  Renamed  ')
    })
    await act(async () => {
      result.current.saveRename(boardPage('abc', 'First page'))
    })

    expect(persistence.updateRemotePage).toHaveBeenCalledWith('abc', { title: 'Renamed' })
    expect(result.current.boardPages[0].title).toBe('Renamed')
    expect(result.current.boardPages[0].updatedAt).toBe('2026-07-25T00:00:00Z')
    expect(result.current.boardPages[1].title).toBe('Second page')
    expect(result.current.editing).toBeNull()
    expect(result.current.busy).toBe(false)
  })

  it('keeps the row open and reports a failed rename', async () => {
    persistence.updateRemotePage.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    act(() => {
      result.current.beginRename(boardPage('abc', 'First page'))
      result.current.setRenameDraft('Renamed')
    })
    await act(async () => {
      result.current.saveRename(boardPage('abc', 'First page'))
    })

    expect(toast).toHaveBeenCalledWith('Could not rename the page. Try again.', 'error')
    expect(result.current.boardPages[0].title).toBe('First page')
    expect(result.current.editing).toEqual({ id: 'abc', mode: 'rename' })
    expect(result.current.busy).toBe(false)
  })

  it('reports an expired session instead of the generic rename failure', async () => {
    persistence.updateRemotePage.mockRejectedValue(csrfFailure)

    const { result } = setup()
    act(() => {
      result.current.beginRename(boardPage('abc', 'First page'))
      result.current.setRenameDraft('Renamed')
    })
    await act(async () => {
      result.current.saveRename(boardPage('abc', 'First page'))
    })

    expect(toast).toHaveBeenCalledWith(CSRF_MESSAGE, 'error')
  })

  it('ignores a second save while one is in flight', async () => {
    const pending = deferred<BoardPage>()
    persistence.updateRemotePage.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.beginRename(boardPage('abc', 'First page'))
      result.current.setRenameDraft('Renamed')
    })
    act(() => {
      result.current.saveRename(boardPage('abc', 'First page'))
    })

    expect(result.current.busy).toBe(true)

    act(() => {
      result.current.saveRename(boardPage('abc', 'First page'))
    })

    expect(persistence.updateRemotePage).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve(boardPage('abc', 'Renamed'))
    })

    expect(result.current.busy).toBe(false)
  })
})

describe('usePages delete', () => {
  it('marks the row for deletion without touching the server', () => {
    const { result } = setup()

    act(() => {
      result.current.beginDelete(boardPage('def', 'Second page'))
    })

    expect(result.current.editing).toEqual({ id: 'def', mode: 'delete' })
    expect(persistence.deleteRemotePage).not.toHaveBeenCalled()
  })

  it('drops a non-active page from the list and stays put', async () => {
    persistence.deleteRemotePage.mockResolvedValue({ redirectUrl: '/dashboard' })

    const { result } = setup()
    act(() => {
      result.current.beginDelete(boardPage('def', 'Second page'))
    })
    await act(async () => {
      result.current.confirmDelete(boardPage('def', 'Second page'))
    })

    expect(persistence.deleteRemotePage).toHaveBeenCalledWith('def')
    expect(result.current.boardPages.map((page) => page.publicId)).toEqual(['abc'])
    expect(routerMock.visit).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
    expect(result.current.editing).toBeNull()
  })

  it('closes the host and replaces the history entry after deleting the active page', async () => {
    persistence.deleteRemotePage.mockResolvedValue({ redirectUrl: '/dashboard' })

    const { result } = setup()
    await act(async () => {
      result.current.confirmDelete(boardPage('abc', 'First page'))
    })

    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(routerMock.visit).toHaveBeenCalledWith('/dashboard', { replace: true })
    expect(result.current.boardPages.map((page) => page.publicId)).toEqual(['abc', 'def'])
  })

  it('keeps the page and reports a failed delete', async () => {
    persistence.deleteRemotePage.mockRejectedValue(new Error('boom'))

    const { result } = setup()
    await act(async () => {
      result.current.confirmDelete(boardPage('def', 'Second page'))
    })

    expect(toast).toHaveBeenCalledWith('Could not delete the page. Try again.', 'error')
    expect(result.current.boardPages.map((page) => page.publicId)).toEqual(['abc', 'def'])
    expect(result.current.busy).toBe(false)
  })

  it('reports an expired session instead of the generic delete failure', async () => {
    persistence.deleteRemotePage.mockRejectedValue(csrfFailure)

    const { result } = setup()
    await act(async () => {
      result.current.confirmDelete(boardPage('def', 'Second page'))
    })

    expect(toast).toHaveBeenCalledWith(CSRF_MESSAGE, 'error')
  })

  it('ignores a second delete while one is in flight', async () => {
    const pending = deferred<{ redirectUrl: string }>()
    persistence.deleteRemotePage.mockReturnValue(pending.promise)

    const { result } = setup()
    act(() => {
      result.current.confirmDelete(boardPage('def', 'Second page'))
    })
    act(() => {
      result.current.confirmDelete(boardPage('def', 'Second page'))
    })

    expect(persistence.deleteRemotePage).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ redirectUrl: '/dashboard' })
    })

    expect(result.current.busy).toBe(false)
  })
})
