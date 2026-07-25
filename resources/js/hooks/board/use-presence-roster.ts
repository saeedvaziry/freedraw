import { useMemo, useSyncExternalStore } from 'react'
import type { PresenceKind, PresenceParticipant } from '@/lib/presence'

export interface PresencePeer {
  clientId: number
  id: string
  kind: PresenceKind
  name: string
  color: string
  avatar: string | null
  isLocal: boolean
  selectedCount: number
}

export interface PresenceRosterSource {
  active: boolean
  readParticipants(): PresenceParticipant[]
  subscribe(listener: () => void): () => void
}

export interface UsePresenceRosterOptions {
  previewing?: boolean
}

export interface PresenceRosterView {
  active: boolean
  previewing: boolean
  peers: PresencePeer[]
  others: PresencePeer[]
  local: PresencePeer | null
  count: number
}

const EMPTY_PEERS: PresencePeer[] = []

export function toPresencePeer(
  participant: PresenceParticipant,
  previewing = false,
): PresencePeer {
  return {
    clientId: participant.clientId,
    id: participant.user.id,
    kind: participant.user.kind,
    name: participant.user.name,
    color: participant.user.color,
    avatar: participant.user.avatar,
    isLocal: participant.isLocal,
    selectedCount: previewing ? 0 : participant.selection.length,
  }
}

export function samePresencePeers(
  a: readonly PresencePeer[],
  b: readonly PresencePeer[],
): boolean {
  if (a.length !== b.length) return false
  return a.every((peer, index) => {
    const other = b[index]
    return (
      peer.clientId === other.clientId &&
      peer.id === other.id &&
      peer.kind === other.kind &&
      peer.name === other.name &&
      peer.color === other.color &&
      peer.avatar === other.avatar &&
      peer.isLocal === other.isLocal &&
      peer.selectedCount === other.selectedCount
    )
  })
}

interface PresencePeerStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): PresencePeer[]
  getServerSnapshot(): PresencePeer[]
}

export function createPresencePeerStore(
  source: PresenceRosterSource,
  previewing = false,
): PresencePeerStore {
  let snapshot: PresencePeer[] | null = null

  const read = (): PresencePeer[] => {
    const next = source.active
      ? source.readParticipants().map((participant) => toPresencePeer(participant, previewing))
      : EMPTY_PEERS
    if (snapshot !== null && samePresencePeers(snapshot, next)) return snapshot
    snapshot = next
    return next
  }

  return {
    subscribe: (listener) => source.subscribe(listener),
    getSnapshot: read,
    getServerSnapshot: () => EMPTY_PEERS,
  }
}

export function usePresenceRoster(
  source: PresenceRosterSource,
  options: UsePresenceRosterOptions = {},
): PresenceRosterView {
  const { active, readParticipants, subscribe } = source
  const { previewing = false } = options

  const store = useMemo(
    () => createPresencePeerStore({ active, readParticipants, subscribe }, previewing),
    [active, previewing, readParticipants, subscribe],
  )
  const peers = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  return useMemo(
    () => ({
      active,
      previewing,
      peers,
      others: peers.filter((peer) => !peer.isLocal),
      local: peers.find((peer) => peer.isLocal) ?? null,
      count: peers.length,
    }),
    [active, previewing, peers],
  )
}
