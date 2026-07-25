import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { WS, awarenessStub, destroySpy, providerRef } = vi.hoisted(() => ({
  WS: {
    Connecting: 'connecting',
    Connected: 'connected',
    Disconnected: 'disconnected',
  } as const,
  awarenessStub: { clientID: 42 },
  destroySpy: vi.fn(),
  providerRef: { current: null as unknown as Record<string, (arg: unknown) => void> & Record<string, unknown> },
}))

vi.mock('@hocuspocus/provider', () => ({
  WebSocketStatus: WS,
  HocuspocusProvider: vi.fn(function (config: Record<string, unknown>) {
    providerRef.current = config as (typeof providerRef)['current']
    return { destroy: destroySpy, awareness: awarenessStub }
  }),
}))

import { WebSocketStatus } from '@hocuspocus/provider'
import { createCollabSync, deriveSyncStatus } from './collab-provider.js'
import { fetchRealtimeToken } from './page-api.js'

describe('deriveSyncStatus', () => {
  it('reports offline while disconnected', () => {
    expect(deriveSyncStatus(WebSocketStatus.Disconnected, true, 0)).toBe('offline')
    expect(deriveSyncStatus(WebSocketStatus.Disconnected, false, 5)).toBe('offline')
  })

  it('reports saved only when connected, synced and fully flushed', () => {
    expect(deriveSyncStatus(WebSocketStatus.Connected, true, 0)).toBe('saved')
  })

  it('reports saving while connecting or with pending changes', () => {
    expect(deriveSyncStatus(WebSocketStatus.Connecting, false, 0)).toBe('saving')
    expect(deriveSyncStatus(WebSocketStatus.Connected, false, 0)).toBe('saving')
    expect(deriveSyncStatus(WebSocketStatus.Connected, true, 2)).toBe('saving')
  })
})

describe('createCollabSync', () => {
  beforeEach(() => {
    destroySpy.mockClear()
  })

  it('binds the provider to the doc, room and url with a token fetcher', () => {
    const doc = new Y.Doc()
    createCollabSync({ doc, room: 'room-1', url: 'wss://x/collab', tokenUrl: '/pages/room-1/realtime-token' })

    expect(providerRef.current.name).toBe('room-1')
    expect(providerRef.current.url).toBe('wss://x/collab')
    expect(providerRef.current.document).toBe(doc)
    expect(typeof providerRef.current.token).toBe('function')
  })

  it('exposes the provider awareness for presence writers', () => {
    const doc = new Y.Doc()
    const sync = createCollabSync({ doc, room: 'r', url: 'wss://x', tokenUrl: '/t' })

    expect(sync.awareness).toBe(awarenessStub)
  })

  it('maps provider lifecycle events onto the sync status', () => {
    const doc = new Y.Doc()
    const sync = createCollabSync({ doc, room: 'r', url: 'wss://x', tokenUrl: '/t' })
    const listener = vi.fn()
    sync.subscribe(listener)

    expect(sync.getStatus()).toBe('saving')

    providerRef.current.onSynced({ state: true })
    providerRef.current.onStatus({ status: WebSocketStatus.Connected })
    expect(sync.getStatus()).toBe('saved')

    providerRef.current.onUnsyncedChanges({ number: 3 })
    expect(sync.getStatus()).toBe('saving')

    providerRef.current.onUnsyncedChanges({ number: 0 })
    expect(sync.getStatus()).toBe('saved')

    providerRef.current.onDisconnect({})
    expect(sync.getStatus()).toBe('offline')

    expect(listener).toHaveBeenCalled()
  })

  it('stops emitting and destroys the provider on destroy', () => {
    const doc = new Y.Doc()
    const sync = createCollabSync({ doc, room: 'r', url: 'wss://x', tokenUrl: '/t' })
    const listener = vi.fn()
    sync.subscribe(listener)

    sync.destroy()
    expect(destroySpy).toHaveBeenCalledTimes(1)

    listener.mockClear()
    providerRef.current.onStatus({ status: WebSocketStatus.Connected })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('fetchRealtimeToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to the token url and returns the issued token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt-token', expiresAt: '2026-01-01T00:00:00Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const token = await fetchRealtimeToken('/pages/abc/realtime-token')

    expect(token).toBe('jwt-token')
    expect(fetchMock).toHaveBeenCalledWith(
      '/pages/abc/realtime-token',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    )
  })
})
