import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PresenceParticipant } from '@/lib/presence'
import {
  createPresencePeerStore,
  samePresencePeers,
  toPresencePeer,
  usePresenceRoster,
  type PresencePeer,
  type PresenceRosterSource,
} from './use-presence-roster.js'

function participant(
  clientId: number,
  overrides: Partial<PresenceParticipant> = {},
): PresenceParticipant {
  return {
    clientId,
    isLocal: false,
    user: {
      id: `user:${clientId}`,
      kind: 'user',
      name: `Peer ${clientId}`,
      color: '#0090ff',
      avatar: null,
    },
    cursor: null,
    selection: [],
    tool: null,
    viewport: null,
    drag: null,
    laser: null,
    updatedAt: 1,
    ...overrides,
  }
}

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

interface FakeSource extends PresenceRosterSource {
  emit(next?: PresenceParticipant[]): void
  listeners(): number
}

function fakeSource(participants: PresenceParticipant[] = [], active = true): FakeSource {
  const listeners = new Set<() => void>()
  let current = participants

  return {
    active,
    readParticipants: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(next) {
      if (next) current = next
      listeners.forEach((listener) => listener())
    },
    listeners: () => listeners.size,
  }
}

interface RosterProps {
  source: PresenceRosterSource
  previewing?: boolean
}

function setup(initialProps: RosterProps) {
  let renders = 0
  const view = renderHook(
    ({ source, previewing }: RosterProps) => {
      renders += 1
      return usePresenceRoster(source, { previewing })
    },
    { initialProps },
  )

  return { ...view, renders: () => renders }
}

describe('toPresencePeer', () => {
  it('keeps only the identity fields the stack paints', () => {
    const source = participant(4, {
      isLocal: true,
      selection: ['a', 'b'],
      cursor: { x: 10, y: 20 },
      tool: 'select',
      updatedAt: 99,
      user: {
        id: 'user:7',
        kind: 'user',
        name: 'Ada',
        color: '#ff0000',
        avatar: '/avatars/ada.png',
      },
    })

    expect(toPresencePeer(source)).toEqual({
      clientId: 4,
      id: 'user:7',
      kind: 'user',
      name: 'Ada',
      color: '#ff0000',
      avatar: '/avatars/ada.png',
      isLocal: true,
      selectedCount: 2,
    })
  })

  it('counts an empty selection as nothing selected', () => {
    expect(toPresencePeer(participant(2)).selectedCount).toBe(0)
  })

  it('suspends the selection count while a version preview is open', () => {
    const source = participant(2, { selection: ['a', 'b', 'c'] })

    expect(toPresencePeer(source, true).selectedCount).toBe(0)
    expect(toPresencePeer(source, false).selectedCount).toBe(3)
  })
})

describe('samePresencePeers', () => {
  it('accepts two rosters holding the same identities', () => {
    expect(samePresencePeers([peer(1), peer(2)], [peer(1), peer(2)])).toBe(true)
  })

  it('rejects a roster that gained or lost a peer', () => {
    expect(samePresencePeers([peer(1)], [peer(1), peer(2)])).toBe(false)
    expect(samePresencePeers([peer(1), peer(2)], [peer(2)])).toBe(false)
  })

  it('rejects a changed selection count', () => {
    expect(samePresencePeers([peer(1)], [peer(1, { selectedCount: 1 })])).toBe(false)
  })

  it('rejects a renamed, recoloured or re-avatared peer', () => {
    expect(samePresencePeers([peer(1)], [peer(1, { name: 'Ada' })])).toBe(false)
    expect(samePresencePeers([peer(1)], [peer(1, { color: '#ff0000' })])).toBe(false)
    expect(samePresencePeers([peer(1)], [peer(1, { avatar: '/a.png' })])).toBe(false)
    expect(samePresencePeers([peer(1)], [peer(1, { isLocal: true })])).toBe(false)
    expect(samePresencePeers([peer(1)], [peer(1, { kind: 'guest' })])).toBe(false)
  })

  it('rejects a roster whose peers were reordered', () => {
    expect(samePresencePeers([peer(1), peer(2)], [peer(2), peer(1)])).toBe(false)
  })
})

describe('createPresencePeerStore', () => {
  it('holds the snapshot while a peer only moves its cursor or viewport', () => {
    const source = fakeSource([participant(2, { cursor: { x: 0, y: 0 } })])
    const store = createPresencePeerStore(source)
    const first = store.getSnapshot()

    source.emit([
      participant(2, {
        cursor: { x: 800, y: 450 },
        viewport: { x: 10, y: 10, width: 100, height: 100, zoom: 2 },
        updatedAt: 5_000,
      }),
    ])

    expect(store.getSnapshot()).toBe(first)
  })

  it('replaces the snapshot when a peer changes its selection', () => {
    const source = fakeSource([participant(2)])
    const store = createPresencePeerStore(source)
    const first = store.getSnapshot()

    source.emit([participant(2, { selection: ['a'] })])
    const second = store.getSnapshot()

    expect(second).not.toBe(first)
    expect(second[0].selectedCount).toBe(1)
  })

  it('holds the snapshot through a selection change while previewing', () => {
    const source = fakeSource([participant(2)])
    const store = createPresencePeerStore(source, true)
    const first = store.getSnapshot()

    source.emit([participant(2, { selection: ['a', 'b'] })])

    expect(store.getSnapshot()).toBe(first)
    expect(first[0].selectedCount).toBe(0)
  })

  it('replaces the snapshot when a peer joins or leaves', () => {
    const source = fakeSource([participant(2)])
    const store = createPresencePeerStore(source)
    const first = store.getSnapshot()

    source.emit([participant(2), participant(3)])
    const joined = store.getSnapshot()

    expect(joined).not.toBe(first)
    expect(joined.map((entry) => entry.clientId)).toEqual([2, 3])

    source.emit([participant(3)])

    expect(store.getSnapshot()).not.toBe(joined)
  })

  it('reads a stable empty roster while the source is inactive', () => {
    const source = fakeSource([participant(2)], false)
    const store = createPresencePeerStore(source)

    expect(store.getSnapshot()).toEqual([])
    expect(store.getSnapshot()).toBe(store.getSnapshot())
    expect(store.getServerSnapshot()).toEqual([])
  })

  it('subscribes and unsubscribes through the source', () => {
    const source = fakeSource()
    const store = createPresencePeerStore(source)
    const detach = store.subscribe(() => undefined)

    expect(source.listeners()).toBe(1)

    detach()

    expect(source.listeners()).toBe(0)
  })
})

describe('usePresenceRoster', () => {
  it('splits the roster into the local peer and the others', () => {
    const source = fakeSource([participant(1, { isLocal: true }), participant(2), participant(3)])

    const { result } = setup({ source })

    expect(result.current.active).toBe(true)
    expect(result.current.previewing).toBe(false)
    expect(result.current.count).toBe(3)
    expect(result.current.local?.clientId).toBe(1)
    expect(result.current.others.map((entry) => entry.clientId)).toEqual([2, 3])
  })

  it('reports an empty roster while presence is inactive', () => {
    const { result } = setup({ source: fakeSource([participant(2)], false) })

    expect(result.current.active).toBe(false)
    expect(result.current.peers).toEqual([])
    expect(result.current.others).toEqual([])
    expect(result.current.local).toBeNull()
    expect(result.current.count).toBe(0)
  })

  it('does not re-render while a peer only pans or moves its cursor', () => {
    const source = fakeSource([participant(2, { cursor: { x: 0, y: 0 } })])
    const { result, renders } = setup({ source })
    const before = result.current.peers
    const renderedBefore = renders()

    act(() => {
      source.emit([
        participant(2, {
          cursor: { x: 640, y: 480 },
          viewport: { x: 5, y: 5, width: 200, height: 200, zoom: 1.5 },
          updatedAt: 9_000,
        }),
      ])
    })

    expect(result.current.peers).toBe(before)
    expect(renders()).toBe(renderedBefore)
  })

  it('re-renders when a peer changes its selection', () => {
    const source = fakeSource([participant(2)])
    const { result, renders } = setup({ source })
    const before = result.current.peers
    const renderedBefore = renders()

    act(() => {
      source.emit([participant(2, { selection: ['a', 'b'] })])
    })

    expect(result.current.peers).not.toBe(before)
    expect(result.current.peers[0].selectedCount).toBe(2)
    expect(renders()).toBeGreaterThan(renderedBefore)
  })

  it('re-renders when a peer joins', () => {
    const source = fakeSource([participant(2)])
    const { result } = setup({ source })

    act(() => {
      source.emit([participant(2), participant(3)])
    })

    expect(result.current.count).toBe(2)
  })

  it('round-trips the preview flag and suspends the selection counts', () => {
    const source = fakeSource([participant(2, { selection: ['a', 'b'] })])
    const { result, rerender } = setup({ source, previewing: true })

    expect(result.current.previewing).toBe(true)
    expect(result.current.peers[0].selectedCount).toBe(0)

    rerender({ source, previewing: false })

    expect(result.current.previewing).toBe(false)
    expect(result.current.peers[0].selectedCount).toBe(2)
  })

  it('detaches from the source on unmount', () => {
    const source = fakeSource([participant(2)])
    const { unmount } = setup({ source })

    expect(source.listeners()).toBe(1)

    unmount()

    expect(source.listeners()).toBe(0)
  })
})
