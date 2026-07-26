import { render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { SceneStore, seedAppState } from '@freedraw/engine'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PresencePeer } from '@/hooks/board/use-presence-roster.js'

const { pageProps, boardMock, rosterMock, followMock } = vi.hoisted(() => ({
  pageProps: { current: {} as Record<string, unknown> },
  boardMock: { createBoard: vi.fn() },
  rosterMock: { peers: [] as PresencePeer[] },
  followMock: { followingId: null as number | null },
}))

vi.mock('@freedraw/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@freedraw/engine')>()

  const detach = () => () => undefined

  class FakeEditorController {
    viewportSize = { width: 800, height: 600 }
    camera = { x: 0, y: 0, zoom: 1 }
    zoom = 1
    isDark = false
    isReadOnly = false
    cursorWorldPoint = null
    activeEdit = null
    activeInteraction = null
    flowContext = null
    mount = () => () => undefined
    setDark = () => undefined
    setColors = () => undefined
    setReadOnly = () => undefined
    setImageBlobLoader = () => undefined
    getViewport = () => ({ x: 0, y: 0, zoom: 1 })
    focusViewport = () => undefined
    viewportCenter = () => ({ x: 0, y: 0 })
    screenToWorld = (point: { x: number; y: number }) => point
    worldToScreen = (point: { x: number; y: number }) => point
    zoomToFit = () => undefined
    zoomToRect = () => undefined
    zoomToActualSize = () => undefined
    subscribeCamera = detach()
    subscribeCameraInput = detach()
    subscribeContextMenu = detach()
    subscribeCursor = detach()
    subscribeEdit = detach()
    subscribeInteraction = detach()
  }

  return { ...actual, EditorController: FakeEditorController }
})

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
    router: { visit: vi.fn(), flushAll: vi.fn(), reload: vi.fn(), post: vi.fn() },
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

vi.mock('./create-board.js', () => boardMock)

vi.mock('./presence-stack.js', () => ({
  PresenceStack: () => createElement('div', { 'data-test': 'presence-stack-stub' }),
}))

vi.mock('@/hooks/board/use-presence-roster.js', () => ({
  usePresenceRoster: () => ({
    active: true,
    previewing: false,
    peers: rosterMock.peers,
    others: rosterMock.peers.filter((entry) => !entry.isLocal),
    local: rosterMock.peers.find((entry) => entry.isLocal) ?? null,
    count: rosterMock.peers.length,
  }),
}))

vi.mock('@/hooks/board/use-follow-peer.js', () => ({
  useFollowPeer: () => ({
    followingId: followMock.followingId,
    peer: null,
    follow: vi.fn(),
    stop: vi.fn(),
    toggle: vi.fn(),
  }),
}))

import { BoardRoute } from './board-route.js'

function peer(clientId: number, overrides: Partial<PresencePeer> = {}): PresencePeer {
  return {
    clientId,
    id: `user:${clientId}`,
    kind: 'user',
    name: `Peer ${clientId}`,
    color: '#0090ff',
    avatar: null,
    isLocal: false,
    selectedCount: 0,
    ...overrides,
  }
}

function createFakeBoard() {
  const doc = new Y.Doc()
  seedAppState(doc)

  return {
    store: new SceneStore(doc),
    persistence: { doc, whenSynced: Promise.resolve(), clear: vi.fn(), destroy: vi.fn() },
    sync: undefined,
    page: null,
    assetSource: { kind: 'local' },
  }
}

async function renderRoute() {
  render(createElement(TooltipProvider, { children: createElement(BoardRoute) as ReactNode }))
  await waitFor(() => {
    expect(document.querySelector('canvas')).not.toBeNull()
  })
}

function stacks(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-test="presence-stack-stub"]')]
}

beforeEach(() => {
  vi.clearAllMocks()
  pageProps.current = {
    auth: { user: null },
    boardPage: null,
    boardPages: [],
    livePageIds: [],
    currentOrganization: null,
    organizations: [],
    boardAccess: null,
  }
  rosterMock.peers = []
  followMock.followingId = null
  boardMock.createBoard.mockImplementation(() => Promise.resolve(createFakeBoard()))
})

describe('BoardRoute presence chrome', () => {
  it('renders no presence stack while the local peer is alone on the board', async () => {
    rosterMock.peers = [peer(1, { isLocal: true })]

    await renderRoute()

    expect(stacks()).toHaveLength(0)
  })

  it('renders the presence stack in both the mobile and the desktop chrome', async () => {
    rosterMock.peers = [peer(1, { isLocal: true }), peer(2)]

    await renderRoute()

    const containers = stacks().map((stack) => stack.parentElement?.className ?? '')

    expect(containers).toHaveLength(2)
    expect(containers.filter((className) => className.includes('sm:hidden'))).toHaveLength(1)
    expect(containers.filter((className) => className.includes('sm:flex'))).toHaveLength(1)
  })
})
