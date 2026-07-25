import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PresenceAwareness,
  PresenceIdentity,
  PresenceState,
  PresenceWriter,
} from '@/lib/presence'

const { pageProps, presence } = vi.hoisted(() => ({
  pageProps: { current: {} as Record<string, unknown> },
  presence: { createPresenceWriter: vi.fn() },
}))

vi.mock('@inertiajs/react', () => ({
  usePage: () => ({ props: pageProps.current }),
}))

vi.mock('@/lib/presence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/presence')>()
  return { ...actual, createPresenceWriter: presence.createPresenceWriter }
})

import { usePresence, type UsePresenceOptions } from './use-presence.js'

interface FakeAwareness extends PresenceAwareness {
  seed(clientId: number, state: PresenceState): void
  emit(): void
  handlers(): number
}

function fakeAwareness(clientId = 1): FakeAwareness {
  const states = new Map<number, Record<string, unknown>>()
  const handlers = new Set<() => void>()

  return {
    clientID: clientId,
    getLocalState: () => states.get(clientId) ?? null,
    setLocalState(state) {
      if (state === null) states.delete(clientId)
      else states.set(clientId, state)
    },
    setLocalStateField(field, value) {
      states.set(clientId, { ...(states.get(clientId) ?? {}), [field]: value })
    },
    getStates: () => states,
    on(_event, handler) {
      handlers.add(handler)
    },
    off(_event, handler) {
      handlers.delete(handler)
    },
    seed(id, state) {
      states.set(id, { presence: state })
    },
    emit() {
      handlers.forEach((handler) => handler())
    },
    handlers: () => handlers.size,
  }
}

function fakeWriter() {
  return {
    identity: null as unknown as PresenceIdentity,
    readOnly: false,
    getState: vi.fn(),
    setCursor: vi.fn(),
    setSelection: vi.fn(),
    setTool: vi.fn(),
    setViewport: vi.fn(),
    setDrag: vi.fn(),
    setReadOnly: vi.fn(),
    flush: vi.fn(),
    clear: vi.fn(),
    destroy: vi.fn(),
  }
}

function peerState(id: string, name: string): PresenceState {
  return {
    user: { id, kind: 'user', name, color: '#0090ff', avatar: null },
    cursor: null,
    selection: [],
    tool: null,
    viewport: null,
    drag: null,
    updatedAt: 1,
  }
}

function setup(options: UsePresenceOptions) {
  return renderHook((props: UsePresenceOptions) => usePresence(props), { initialProps: options })
}

function lastWriter(): ReturnType<typeof fakeWriter> {
  const results = presence.createPresenceWriter.mock.results
  return results[results.length - 1].value as ReturnType<typeof fakeWriter>
}

function writerOptions(call = 0): Record<string, unknown> {
  return presence.createPresenceWriter.mock.calls[call][2] as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  pageProps.current = {}
  presence.createPresenceWriter.mockImplementation(
    () => fakeWriter() as unknown as PresenceWriter,
  )
})

describe('usePresence identity', () => {
  it('follows the signed-in user from the inertia props', () => {
    pageProps.current = { auth: { user: { id: 7, name: 'Ada', avatar: '/avatars/ada.png' } } }

    const { result } = setup({ awareness: null })

    expect(result.current.identity).toMatchObject({
      id: 'user:7',
      kind: 'user',
      name: 'Ada',
      avatar: '/avatars/ada.png',
    })
  })

  it('falls back to a guest identity without a signed-in user', () => {
    const { result } = setup({ awareness: null })

    expect(result.current.identity.kind).toBe('guest')
    expect(result.current.identity.id.startsWith('guest:')).toBe(true)
  })

  it('lets an explicit null user override the signed-in one', () => {
    pageProps.current = { auth: { user: { id: 7, name: 'Ada', avatar: null } } }

    const { result } = setup({ awareness: null, user: null })

    expect(result.current.identity.kind).toBe('guest')
  })
})

describe('usePresence writer lifecycle', () => {
  it('writes nothing at all without an awareness', () => {
    const { result } = setup({ awareness: null })

    expect(presence.createPresenceWriter).not.toHaveBeenCalled()
    expect(result.current.active).toBe(false)
    expect(result.current.roster).toEqual([])
    expect(() => result.current.setCursor({ x: 1, y: 2 })).not.toThrow()
  })

  it('stays idle while presence is disabled', () => {
    const { result } = setup({ awareness: fakeAwareness(), enabled: false })

    expect(presence.createPresenceWriter).not.toHaveBeenCalled()
    expect(result.current.active).toBe(false)
  })

  it('creates exactly one writer for the awareness and destroys it on unmount', () => {
    const awareness = fakeAwareness()
    const { result, unmount } = setup({ awareness, cursorIntervalMs: 20, viewportIntervalMs: 60 })

    expect(presence.createPresenceWriter).toHaveBeenCalledTimes(1)
    expect(presence.createPresenceWriter.mock.calls[0][0]).toBe(awareness)
    expect(presence.createPresenceWriter.mock.calls[0][1]).toBe(result.current.identity)
    expect(writerOptions()).toEqual({
      cursorIntervalMs: 20,
      viewportIntervalMs: 60,
      readOnly: false,
    })
    expect(result.current.active).toBe(true)

    const writer = lastWriter()
    unmount()

    expect(writer.destroy).toHaveBeenCalledTimes(1)
  })

  it('starts the writer read-only when the board is read-only', () => {
    setup({ awareness: fakeAwareness(), readOnly: true })

    expect(writerOptions().readOnly).toBe(true)
  })

  it('gates the live writer when the board turns read-only', () => {
    const awareness = fakeAwareness()
    const { rerender } = setup({ awareness, readOnly: false })
    const writer = lastWriter()

    rerender({ awareness, readOnly: true })

    expect(writer.setReadOnly).toHaveBeenCalledWith(true)
    expect(presence.createPresenceWriter).toHaveBeenCalledTimes(1)

    rerender({ awareness, readOnly: false })

    expect(writer.setReadOnly).toHaveBeenLastCalledWith(false)
  })

  it('keeps the same writer while the user details are unchanged', () => {
    const awareness = fakeAwareness()
    const { rerender } = setup({ awareness, user: { id: 7, name: 'Ada', avatar: null } })

    rerender({ awareness, user: { id: 7, name: 'Ada', avatar: null } })

    expect(presence.createPresenceWriter).toHaveBeenCalledTimes(1)
  })

  it('replaces the writer when the user changes', () => {
    const awareness = fakeAwareness()
    const { rerender } = setup({ awareness, user: { id: 7, name: 'Ada', avatar: null } })
    const first = lastWriter()

    rerender({ awareness, user: { id: 8, name: 'Grace', avatar: null } })

    expect(first.destroy).toHaveBeenCalledTimes(1)
    expect(presence.createPresenceWriter).toHaveBeenCalledTimes(2)
    expect(lastWriter()).not.toBe(first)
  })

  it('replaces the writer when the awareness is swapped out', () => {
    const first = fakeAwareness(1)
    const { rerender } = setup({ awareness: first })
    const writer = lastWriter()

    rerender({ awareness: fakeAwareness(2) })

    expect(writer.destroy).toHaveBeenCalledTimes(1)
    expect(presence.createPresenceWriter.mock.calls[1][0]).not.toBe(first)
  })

  it('tears the writer down when presence is switched off', () => {
    const awareness = fakeAwareness()
    const { result, rerender } = setup({ awareness, enabled: true })
    const writer = lastWriter()

    rerender({ awareness, enabled: false })

    expect(writer.destroy).toHaveBeenCalledTimes(1)
    expect(result.current.active).toBe(false)
  })
})

describe('usePresence writing', () => {
  it('forwards every editor update to the live writer', () => {
    const { result } = setup({ awareness: fakeAwareness() })
    const writer = lastWriter()

    act(() => {
      result.current.setCursor({ x: 1, y: 2 })
      result.current.setSelection(['a', 'b'])
      result.current.setTool('select')
      result.current.setViewport({ x: 0, y: 0, width: 10, height: 10, zoom: 1 })
      result.current.setDrag({ kind: 'move', frame: null })
      result.current.flush()
      result.current.clear()
    })

    expect(writer.setCursor).toHaveBeenCalledWith({ x: 1, y: 2 })
    expect(writer.setSelection).toHaveBeenCalledWith(['a', 'b'])
    expect(writer.setTool).toHaveBeenCalledWith('select')
    expect(writer.setViewport).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      zoom: 1,
    })
    expect(writer.setDrag).toHaveBeenCalledWith({ kind: 'move', frame: null })
    expect(writer.flush).toHaveBeenCalledTimes(1)
    expect(writer.clear).toHaveBeenCalledTimes(1)
  })

  it('stops writing through a writer that was already destroyed', () => {
    const awareness = fakeAwareness()
    const { result, rerender } = setup({ awareness })
    const writer = lastWriter()

    rerender({ awareness: null })
    act(() => {
      result.current.setCursor({ x: 1, y: 2 })
    })

    expect(writer.setCursor).not.toHaveBeenCalled()
  })
})

describe('usePresence roster', () => {
  it('reads the participants published on the awareness', () => {
    const awareness = fakeAwareness()
    awareness.seed(2, peerState('user:9', 'Grace'))

    const { result } = setup({ awareness })

    expect(result.current.roster.map((entry) => entry.name)).toEqual(['Grace'])
    expect(result.current.readParticipants().map((entry) => entry.clientId)).toEqual([2])
  })

  it('re-renders when a peer joins', () => {
    const awareness = fakeAwareness()
    const { result } = setup({ awareness })

    expect(result.current.roster).toEqual([])

    act(() => {
      awareness.seed(2, peerState('user:9', 'Grace'))
      awareness.emit()
    })

    expect(result.current.roster.map((entry) => entry.name)).toEqual(['Grace'])
  })

  it('detaches from the awareness on unmount', () => {
    const awareness = fakeAwareness()
    const { unmount } = setup({ awareness })

    expect(awareness.handlers()).toBeGreaterThan(0)

    unmount()

    expect(awareness.handlers()).toBe(0)
  })

  it('reports no participants without an awareness', () => {
    const { result } = setup({ awareness: null })

    expect(result.current.readParticipants()).toEqual([])
    expect(result.current.subscribe(() => undefined)()).toBeUndefined()
  })
})
