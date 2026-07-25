import type * as Y from 'yjs'
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import { fetchRealtimeToken } from './page-api.js'
import type { PageSync, SyncStatus } from './page-sync.js'

export interface CollabSyncOptions {
  doc: Y.Doc
  room: string
  url: string
  tokenUrl: string
}

export type CollabAwareness = NonNullable<HocuspocusProvider['awareness']>

export interface CollabSync extends PageSync {
  awareness: CollabAwareness | null
}

export interface SyncStatusContext {
  hasConnected?: boolean
  online?: boolean
  authFailed?: boolean
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

export function deriveSyncStatus(
  status: WebSocketStatus,
  synced: boolean,
  unsyncedChanges: number,
  context: SyncStatusContext = {},
): SyncStatus {
  const { hasConnected = false, online = true, authFailed = false } = context

  if (authFailed) return 'no-access'
  if (!online) return 'offline'
  if (status === WebSocketStatus.Connected) {
    return synced && unsyncedChanges === 0 ? 'saved' : 'saving'
  }
  if (hasConnected) return 'reconnecting'
  return status === WebSocketStatus.Disconnected ? 'offline' : 'saving'
}

export function createCollabSync(options: CollabSyncOptions): CollabSync {
  const { doc, room, url, tokenUrl } = options

  let destroyed = false
  let connection: WebSocketStatus = WebSocketStatus.Connecting
  let synced = false
  let unsynced = 0
  let hasConnected = false
  let online = isBrowserOnline()
  let authFailed = false
  let status: SyncStatus = deriveSyncStatus(connection, synced, unsynced, { online })
  const listeners = new Set<() => void>()

  const refresh = (): void => {
    const next = deriveSyncStatus(connection, synced, unsynced, { hasConnected, online, authFailed })
    if (destroyed || status === next) return
    status = next
    listeners.forEach((listener) => listener())
  }

  const handleOnline = (): void => {
    online = true
    refresh()
  }

  const handleOffline = (): void => {
    online = false
    refresh()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  const provider = new HocuspocusProvider({
    url,
    name: room,
    document: doc,
    token: () => fetchRealtimeToken(tokenUrl),
    onStatus: ({ status: next }) => {
      connection = next
      if (next === WebSocketStatus.Connected) hasConnected = true
      refresh()
    },
    onSynced: ({ state }) => {
      synced = state
      refresh()
    },
    onDisconnect: () => {
      connection = WebSocketStatus.Disconnected
      synced = false
      refresh()
    },
    onUnsyncedChanges: ({ number }) => {
      unsynced = number
      refresh()
    },
    onAuthenticated: () => {
      authFailed = false
      refresh()
    },
    onAuthenticationFailed: ({ reason }) => {
      console.warn('Realtime authentication failed', reason)
      authFailed = true
      refresh()
    },
  })

  return {
    awareness: provider.awareness ?? null,
    flush: () => Promise.resolve(),
    destroy() {
      if (destroyed) return
      destroyed = true
      listeners.clear()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
      provider.destroy()
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
