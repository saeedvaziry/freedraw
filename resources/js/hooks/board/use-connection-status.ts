import { useCallback, useSyncExternalStore } from 'react'
import { useBoardContext } from '@/components/board/board-context.js'
import type { SyncStatus } from '@/lib/persistence'

export type ConnectionStatus = SyncStatus | 'view-only'

export type ConnectionTone = 'positive' | 'pending' | 'attention' | 'calm' | 'accent'

export interface ConnectionStatusDescriptor {
  label: string
  description: string
  tone: ConnectionTone
}

export interface ConnectionStatusView extends ConnectionStatusDescriptor {
  status: ConnectionStatus
  visible: boolean
}

export const CONNECTION_STATUS_DESCRIPTORS: Record<ConnectionStatus, ConnectionStatusDescriptor> = {
  saved: {
    label: 'Saved',
    description: 'All changes saved',
    tone: 'positive',
  },
  saving: {
    label: 'Saving',
    description: 'Saving your changes…',
    tone: 'pending',
  },
  reconnecting: {
    label: 'Reconnecting',
    description: 'Reconnecting — your changes are safe and sync as soon as the connection is back',
    tone: 'attention',
  },
  offline: {
    label: 'Offline',
    description: 'Offline — keep working, changes are saved on this device and sync later',
    tone: 'calm',
  },
  'no-access': {
    label: 'No access',
    description:
      'No access — your session no longer has permission to sync this board. Sign in again or ask for access; edits stay on this device until then',
    tone: 'attention',
  },
  'view-only': {
    label: 'View only',
    description: 'View only — you can pan, zoom and export, but not edit this board',
    tone: 'accent',
  },
}

const noop = (): void => {}

export function useConnectionStatus(): ConnectionStatusView {
  const { sync, readOnly } = useBoardContext()

  const subscribe = useCallback(
    (listener: () => void) => sync?.subscribe(listener) ?? noop,
    [sync],
  )
  const getSnapshot = useCallback((): SyncStatus => sync?.getStatus() ?? 'saved', [sync])
  const getServerSnapshot = useCallback((): SyncStatus => 'saved', [])

  const syncStatus = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const status: ConnectionStatus = readOnly ? 'view-only' : syncStatus

  return {
    status,
    visible: readOnly || Boolean(sync),
    ...CONNECTION_STATUS_DESCRIPTORS[status],
  }
}
