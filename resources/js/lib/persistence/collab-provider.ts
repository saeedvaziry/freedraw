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

export function deriveSyncStatus(
  status: WebSocketStatus,
  synced: boolean,
  unsyncedChanges: number,
): SyncStatus {
  if (status === WebSocketStatus.Disconnected) return 'offline'
  if (status === WebSocketStatus.Connected && synced && unsyncedChanges === 0) return 'saved'
  return 'saving'
}

export function createCollabSync(options: CollabSyncOptions): PageSync {
  const { doc, room, url, tokenUrl } = options

  let destroyed = false
  let status: SyncStatus = 'saving'
  let connection: WebSocketStatus = WebSocketStatus.Connecting
  let synced = false
  let unsynced = 0
  const listeners = new Set<() => void>()

  const refresh = (): void => {
    const next = deriveSyncStatus(connection, synced, unsynced)
    if (destroyed || status === next) return
    status = next
    listeners.forEach((listener) => listener())
  }

  const provider = new HocuspocusProvider({
    url,
    name: room,
    document: doc,
    token: () => fetchRealtimeToken(tokenUrl),
    onStatus: ({ status: next }) => {
      connection = next
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
    onAuthenticationFailed: ({ reason }) => {
      console.warn('Realtime authentication failed', reason)
    },
  })

  return {
    flush: () => Promise.resolve(),
    destroy() {
      if (destroyed) return
      destroyed = true
      listeners.clear()
      provider.destroy()
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
