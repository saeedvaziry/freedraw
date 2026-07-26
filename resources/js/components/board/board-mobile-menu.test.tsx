import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorController, SceneStore } from '@freedraw/engine'
import type { BoardExport } from '@/hooks/board/use-export.js'
import type { BoardPage, Organization, User } from '@/types'
import { BoardProvider, type BoardContextValue } from './board-context.js'

const { pageProps, routerMock } = vi.hoisted(() => ({
  pageProps: { current: {} as Record<string, unknown> },
  routerMock: {
    visit: vi.fn(),
    flushAll: vi.fn(),
    reload: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@inertiajs/react', () => {
  interface AnchorProps {
    href?: string
    children?: ReactNode
    method?: string
    as?: string
    prefetch?: boolean
    [key: string]: unknown
  }

  return {
    usePage: () => ({ props: pageProps.current }),
    router: routerMock,
    Link: ({ href, children, method, as, prefetch, ...rest }: AnchorProps) =>
      createElement('a', { href, ...rest }, children),
    Form: ({ children }: { children?: ReactNode }) => createElement('form', null, children),
    useForm: () => ({
      data: {},
      setData: vi.fn(),
      post: vi.fn(),
      processing: false,
      errors: {},
      reset: vi.fn(),
    }),
    Head: () => null,
  }
})

import { BoardMobileMenu } from './board-mobile-menu.js'

interface StoreState {
  selectedIds?: string[]
  elements?: Record<string, { groupId?: string | null; locked?: boolean }>
}

function createStore(state: StoreState = {}) {
  const ui = { selectedIds: new Set(state.selectedIds ?? []) }
  const snapshot = {
    order: Object.keys(state.elements ?? {}),
    elements: state.elements ?? {},
    appState: { snapGuidesEnabled: false },
  }

  const store = {
    getUiState: () => ui,
    getSnapshot: () => snapshot,
    select: <T,>(selector: (source: unknown) => T) => {
      const value = selector(store)
      return {
        subscribe: () => () => {},
        getSnapshot: () => value,
      }
    },
    groupElements: vi.fn(),
    ungroupElements: vi.fn(),
    lockElements: vi.fn(),
    unlockElements: vi.fn(),
    alignElements: vi.fn(),
    bringToFront: vi.fn(),
    bringForward: vi.fn(),
    sendBackward: vi.fn(),
    sendToBack: vi.fn(),
  }

  return store
}

type FakeStore = ReturnType<typeof createStore>

const boardExport = {
  exportImage: vi.fn(),
  exportSvg: vi.fn(),
  copyImage: vi.fn(),
  exportScene: vi.fn(),
  importScene: vi.fn(),
} as unknown as BoardExport

function boardValue(store: FakeStore, readOnly = false): BoardContextValue {
  return {
    store: store as unknown as SceneStore,
    controller: null as unknown as EditorController | null,
    boardExport,
    theme: 'light',
    readOnly,
    scope: 'edit',
    openImagePicker: vi.fn(),
    sync: null,
  }
}

function user(): User {
  return {
    id: 1,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    email_verified_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function organization(id: number, name: string, slug: string): Organization {
  return { id, name, slug, isPersonal: false }
}

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
    canShare: false,
    canEdit: true,
    updatedAt: null,
  }
}

interface Props {
  store?: FakeStore
  readOnly?: boolean
}

async function openMenu({ store = createStore(), readOnly = false }: Props = {}) {
  render(
    createElement(BoardProvider, {
      value: boardValue(store, readOnly),
      children: createElement(BoardMobileMenu),
    }),
  )

  fireEvent.click(screen.getByLabelText('Menu'))
  await screen.findByText('FreeDraw')

  return store
}

function menuButton(testId: string): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(`[data-test="${testId}"]`)
  if (!found) throw new Error(`Missing element ${testId}`)
  return found
}

beforeEach(() => {
  vi.clearAllMocks()
  pageProps.current = {
    auth: { user: null },
    currentOrganization: null,
    organizations: [],
    boardPage: null,
    boardPages: [],
  }
})

describe('BoardMobileMenu guest rendering', () => {
  it('offers log in and register instead of the account sections', async () => {
    await openMenu()

    expect(screen.getByText('Log in').closest('a')?.getAttribute('href')).toBe('/login')
    expect(screen.getByText('Register').closest('a')?.getAttribute('href')).toBe('/register')
    expect(screen.getByText('Home').closest('a')?.getAttribute('href')).toBe('/')
    expect(screen.queryByText('Settings')).toBeNull()
    expect(screen.queryByText('Pages')).toBeNull()
    expect(screen.queryByText('Select organization')).toBeNull()
    expect(document.querySelector('[data-test="board-mobile-menu-logout"]')).toBeNull()
  })
})

describe('BoardMobileMenu authenticated rendering', () => {
  beforeEach(() => {
    pageProps.current = {
      auth: { user: user() },
      currentOrganization: organization(1, 'Acme', 'acme'),
      organizations: [organization(1, 'Acme', 'acme'), organization(2, 'Globex', 'globex')],
      boardPage: boardPage('abc', 'First page'),
      boardPages: [boardPage('abc', 'First page'), boardPage('def', 'Second page')],
    }
  })

  it('renders the account sections and hides the guest links', async () => {
    await openMenu()

    expect(screen.getByText('Settings').closest('a')?.getAttribute('href')).toBe(
      '/settings/profile',
    )
    expect(screen.getByText('Pages')).not.toBeNull()
    expect(screen.getByText('First page')).not.toBeNull()
    expect(screen.getByText('Second page')).not.toBeNull()
    expect(screen.getByText('Ada Lovelace')).not.toBeNull()
    expect(menuButton('board-mobile-menu-logout')).not.toBeNull()
    expect(screen.queryByText('Log in')).toBeNull()
    expect(screen.queryByText('Register')).toBeNull()
  })

  it('shows the current organization and hides the list until expanded', async () => {
    await openMenu()

    expect(screen.getByText('Acme')).not.toBeNull()
    expect(document.querySelectorAll('[data-test="board-mobile-organization-switcher-item"]').length).toBe(0)

    fireEvent.click(menuButton('board-mobile-organization-switcher-trigger'))

    const items = document.querySelectorAll<HTMLButtonElement>(
      '[data-test="board-mobile-organization-switcher-item"]',
    )
    expect([...items].map((item) => item.textContent)).toEqual(['Acme', 'Globex'])
  })

  it('switches organization through a post visit and closes the menu', async () => {
    await openMenu()

    fireEvent.click(menuButton('board-mobile-organization-switcher-trigger'))
    const items = document.querySelectorAll<HTMLButtonElement>(
      '[data-test="board-mobile-organization-switcher-item"]',
    )
    fireEvent.click(items[1])

    expect(routerMock.visit).toHaveBeenCalledTimes(1)
    expect(routerMock.visit.mock.calls[0][0]).toBe('/settings/organizations/globex/switch')
    expect(routerMock.visit.mock.calls[0][1]).toMatchObject({ method: 'post' })
    await waitFor(() => {
      expect(screen.queryByText('Globex')).toBeNull()
    })
  })

  it('flushes cached inertia pages when logging out', async () => {
    await openMenu()

    fireEvent.click(menuButton('board-mobile-menu-logout'))

    expect(routerMock.flushAll).toHaveBeenCalledTimes(1)
  })

  it('tells the user when the organization has no pages yet', async () => {
    pageProps.current = { ...pageProps.current, boardPage: null, boardPages: [] }

    await openMenu()

    expect(screen.getByText('No pages yet. Add one to get started.')).not.toBeNull()
    expect(screen.queryByText('First page')).toBeNull()
  })

  it('keeps the share dialog mounted after closing the mobile sheet', async () => {
    const firstPage = { ...boardPage('abc', 'First page'), canShare: true }
    pageProps.current = {
      ...pageProps.current,
      boardPage: firstPage,
      boardPages: [firstPage, boardPage('def', 'Second page')],
    }

    await openMenu()
    fireEvent.click(screen.getByText('Share page'))

    expect(await screen.findByText('Share “First page”')).not.toBeNull()
    expect(screen.queryByText('Pages')).toBeNull()
  })
})

describe('BoardMobileMenu selection section', () => {
  const twoSelected = {
    selectedIds: ['a', 'b'],
    elements: { a: { locked: false }, b: { locked: false } },
  }

  it('stays hidden while nothing is selected', async () => {
    await openMenu({ store: createStore() })

    expect(screen.queryByText('Selection')).toBeNull()
    expect(document.querySelector('[data-test="board-mobile-action-group"]')).toBeNull()
  })

  it('stays hidden on a read-only board even with a selection', async () => {
    await openMenu({ store: createStore(twoSelected), readOnly: true })

    expect(screen.queryByText('Selection')).toBeNull()
    expect(document.querySelector('[data-test="board-mobile-action-group"]')).toBeNull()
  })

  it('renders every selection action once a selection exists', async () => {
    await openMenu({ store: createStore(twoSelected) })

    expect(screen.getByText('Selection')).not.toBeNull()
    for (const id of ['group', 'ungroup', 'lock', 'unlock-selection', 'align-left', 'order-front']) {
      expect(menuButton(`board-mobile-action-${id}`)).not.toBeNull()
    }
    expect(menuButton('board-mobile-action-group').textContent).toContain('Group')
  })

  it('disables actions their gate rejects for the current selection', async () => {
    await openMenu({
      store: createStore({ selectedIds: ['a'], elements: { a: { locked: false } } }),
    })

    expect(menuButton('board-mobile-action-group').disabled).toBe(true)
    expect(menuButton('board-mobile-action-align-left').disabled).toBe(true)
    expect(menuButton('board-mobile-action-unlock-selection').disabled).toBe(true)
    expect(menuButton('board-mobile-action-lock').disabled).toBe(false)
  })

  it('enables an action once its gate passes', async () => {
    await openMenu({ store: createStore(twoSelected) })

    expect(menuButton('board-mobile-action-group').disabled).toBe(false)
    expect(menuButton('board-mobile-action-align-left').disabled).toBe(false)
  })

  it('runs the action against the store and closes the menu', async () => {
    const store = await openMenu({ store: createStore(twoSelected) })

    fireEvent.click(menuButton('board-mobile-action-group'))

    expect(store.groupElements).toHaveBeenCalledTimes(1)
    expect([...store.groupElements.mock.calls[0][0]]).toEqual(['a', 'b'])
    await waitFor(() => {
      expect(screen.queryByText('Selection')).toBeNull()
    })
  })

  it('routes ordering actions to their own store method', async () => {
    const store = await openMenu({ store: createStore(twoSelected) })

    fireEvent.click(menuButton('board-mobile-action-order-front'))

    expect(store.bringToFront).toHaveBeenCalledTimes(1)
    expect(store.groupElements).not.toHaveBeenCalled()
  })
})
