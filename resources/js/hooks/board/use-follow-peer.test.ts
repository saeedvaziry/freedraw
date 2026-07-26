import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CameraState, EditorController } from '@freedraw/engine'
import type { PresenceParticipant, PresenceViewport } from '@/lib/presence'
import {
  cameraForPresenceViewport,
  sameCamera,
  useFollowPeer,
  type FollowPeerSource,
} from './use-follow-peer.js'
import type { PresencePeer } from './use-presence-roster.js'

const SIZE = { width: 800, height: 600 }

function viewport(overrides: Partial<PresenceViewport> = {}): PresenceViewport {
  return { x: 0, y: 0, width: 400, height: 300, zoom: 1, ...overrides }
}

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
    viewport: viewport(),
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

interface FakeSource extends FollowPeerSource {
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

function fakeController(camera: CameraState = { x: 0, y: 0, zoom: 1 }) {
  const cameraInput = new Set<() => void>()
  let current = camera

  return {
    viewportSize: SIZE,
    getViewport: () => current,
    focusViewport: vi.fn((next: CameraState) => {
      current = next
    }),
    subscribeCameraInput(listener: () => void) {
      cameraInput.add(listener)
      return () => {
        cameraInput.delete(listener)
      }
    },
    moveCamera() {
      cameraInput.forEach((listener) => listener())
    },
    cameraListeners: () => cameraInput.size,
  }
}

type FakeController = ReturnType<typeof fakeController>

interface FollowProps {
  controller: FakeController | null
  source: FakeSource
  peers: readonly PresencePeer[]
}

function setup(overrides: Partial<FollowProps> = {}) {
  const initialProps: FollowProps = {
    controller: overrides.controller === undefined ? fakeController() : overrides.controller,
    source: overrides.source ?? fakeSource([participant(2)]),
    peers: overrides.peers ?? [peer(2)],
  }

  const view = renderHook(
    ({ controller, source, peers }: FollowProps) =>
      useFollowPeer({
        controller: controller as unknown as EditorController | null,
        source,
        peers,
      }),
    { initialProps },
  )

  return { ...view, ...initialProps }
}

function press(key: string): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cameraForPresenceViewport', () => {
  it('centres the peer viewport in a matching aspect ratio', () => {
    expect(cameraForPresenceViewport(viewport(), SIZE)).toEqual({ x: 0, y: 0, zoom: 2 })
  })

  it('fits the tighter axis and keeps the peer centre in view', () => {
    expect(cameraForPresenceViewport(viewport({ x: 100, y: 50, width: 400, height: 400 }), SIZE))
      .toEqual({ x: 100 + 200 - 800 / 3, y: 50, zoom: 1.5 })
  })

  it('offsets the camera by the peer origin', () => {
    expect(cameraForPresenceViewport(viewport({ x: 250, y: -125 }), SIZE)).toEqual({
      x: 250,
      y: -125,
      zoom: 2,
    })
  })

  it('clamps a tiny peer viewport to the maximum zoom', () => {
    expect(cameraForPresenceViewport(viewport({ width: 10, height: 10 }), SIZE)).toEqual({
      x: 5 - 800 / 16,
      y: 5 - 600 / 16,
      zoom: 8,
    })
  })

  it('clamps an enormous peer viewport to the minimum zoom', () => {
    expect(cameraForPresenceViewport(viewport({ width: 100_000, height: 100_000 }), SIZE).zoom).toBe(
      0.1,
    )
  })

  it('falls back to the raw peer origin when the local canvas has no size', () => {
    const peerViewport = viewport({ x: 12, y: 34, zoom: 3 })

    expect(cameraForPresenceViewport(peerViewport, { width: 0, height: 600 })).toEqual({
      x: 12,
      y: 34,
      zoom: 3,
    })
    expect(cameraForPresenceViewport(peerViewport, { width: 800, height: 0 })).toEqual({
      x: 12,
      y: 34,
      zoom: 3,
    })
  })

  it('falls back to the raw peer origin for a degenerate peer viewport', () => {
    expect(
      cameraForPresenceViewport(viewport({ x: 5, y: 6, width: 0, height: 0, zoom: 42 }), SIZE),
    ).toEqual({ x: 5, y: 6, zoom: 8 })
  })
})

describe('sameCamera', () => {
  it('treats sub-pixel drift as the same camera', () => {
    expect(sameCamera({ x: 0, y: 0, zoom: 1 }, { x: 0.001, y: -0.001, zoom: 1.00001 })).toBe(true)
  })

  it('spots a moved or rezoomed camera', () => {
    expect(sameCamera({ x: 0, y: 0, zoom: 1 }, { x: 1, y: 0, zoom: 1 })).toBe(false)
    expect(sameCamera({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 1, zoom: 1 })).toBe(false)
    expect(sameCamera({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0, zoom: 1.5 })).toBe(false)
  })
})

describe('useFollowPeer starting', () => {
  it('follows nobody and touches nothing at first', () => {
    const { result, controller, source } = setup()

    expect(result.current.followingId).toBeNull()
    expect(result.current.peer).toBeNull()
    expect(controller?.focusViewport).not.toHaveBeenCalled()
    expect(source.listeners()).toBe(0)
    expect(controller?.cameraListeners()).toBe(0)
  })

  it('centres the camera on the followed peer and names them from the roster', () => {
    const { result, controller } = setup({
      source: fakeSource([participant(2, { viewport: viewport({ x: 100, y: 50 }) })]),
      peers: [peer(2, { name: 'Ada' })],
    })

    act(() => {
      result.current.follow(2)
    })

    expect(result.current.followingId).toBe(2)
    expect(result.current.peer?.name).toBe('Ada')
    expect(controller?.focusViewport).toHaveBeenCalledWith({ x: 100, y: 50, zoom: 2 })
  })

  it('re-centres as the followed peer keeps moving', () => {
    const source = fakeSource([participant(2)])
    const { result, controller } = setup({ source })

    act(() => {
      result.current.follow(2)
    })
    act(() => {
      source.emit([participant(2, { viewport: viewport({ x: 400, y: 300 }) })])
    })

    expect(controller?.focusViewport).toHaveBeenCalledTimes(2)
    expect(controller?.focusViewport).toHaveBeenLastCalledWith({ x: 400, y: 300, zoom: 2 })
  })

  it('leaves the camera alone when it already matches the peer', () => {
    const { result, controller } = setup({ controller: fakeController({ x: 0, y: 0, zoom: 2 }) })

    act(() => {
      result.current.follow(2)
    })

    expect(result.current.followingId).toBe(2)
    expect(controller?.focusViewport).not.toHaveBeenCalled()
  })

  it('waits for a peer that has not published a viewport yet', () => {
    const { result, controller } = setup({
      source: fakeSource([participant(2, { viewport: null })]),
    })

    act(() => {
      result.current.follow(2)
    })

    expect(result.current.followingId).toBe(2)
    expect(controller?.focusViewport).not.toHaveBeenCalled()
  })

  it('switches between peers and stops when the same peer is toggled twice', () => {
    const { result } = setup({
      source: fakeSource([participant(2), participant(3)]),
      peers: [peer(2), peer(3)],
    })

    act(() => {
      result.current.toggle(2)
    })

    expect(result.current.followingId).toBe(2)

    act(() => {
      result.current.toggle(3)
    })

    expect(result.current.followingId).toBe(3)

    act(() => {
      result.current.toggle(3)
    })

    expect(result.current.followingId).toBeNull()
  })
})

describe('useFollowPeer cancelling', () => {
  it('stops on demand and lets go of every listener', () => {
    const { result, controller, source } = setup()

    act(() => {
      result.current.follow(2)
    })

    expect(source.listeners()).toBe(1)
    expect(controller?.cameraListeners()).toBe(1)

    act(() => {
      result.current.stop()
    })

    expect(result.current.followingId).toBeNull()
    expect(result.current.peer).toBeNull()
    expect(source.listeners()).toBe(0)
    expect(controller?.cameraListeners()).toBe(0)
  })

  it('stops when the user pans or zooms the local canvas', () => {
    const { result, controller } = setup()

    act(() => {
      result.current.follow(2)
    })
    act(() => {
      controller?.moveCamera()
    })

    expect(result.current.followingId).toBeNull()
  })

  it('stops on Escape and ignores every other key', () => {
    const { result } = setup()

    act(() => {
      result.current.follow(2)
    })
    press('a')

    expect(result.current.followingId).toBe(2)

    press('Escape')

    expect(result.current.followingId).toBeNull()
  })

  it('stops when the followed peer leaves the board', () => {
    const source = fakeSource([participant(2)])
    const { result, controller } = setup({ source })

    act(() => {
      result.current.follow(2)
    })
    controller?.focusViewport.mockClear()
    act(() => {
      source.emit([])
    })

    expect(result.current.followingId).toBeNull()
    expect(controller?.focusViewport).not.toHaveBeenCalled()
  })

  it('refuses to follow the local participant', () => {
    const { result, controller } = setup({
      source: fakeSource([participant(2, { isLocal: true })]),
    })

    act(() => {
      result.current.follow(2)
    })

    expect(result.current.followingId).toBeNull()
    expect(controller?.focusViewport).not.toHaveBeenCalled()
  })

  it('refuses to follow a peer that is not on the board', () => {
    const { result } = setup({ source: fakeSource([participant(3)]) })

    act(() => {
      result.current.follow(2)
    })

    expect(result.current.followingId).toBeNull()
  })

  it('stops when the canvas controller goes away', () => {
    const { result, rerender, source, peers } = setup()

    act(() => {
      result.current.follow(2)
    })
    rerender({ controller: null, source, peers })

    expect(result.current.followingId).toBeNull()
    expect(source.listeners()).toBe(0)
  })

  it('stops when presence goes inactive', () => {
    const { result, rerender, controller, peers } = setup()

    act(() => {
      result.current.follow(2)
    })
    rerender({ controller, source: fakeSource([participant(2)], false), peers })

    expect(result.current.followingId).toBeNull()
  })

  it('ignores presence updates once it has been unmounted', () => {
    const source = fakeSource([participant(2)])
    const { result, unmount, controller } = setup({ source })

    act(() => {
      result.current.follow(2)
    })
    unmount()

    expect(source.listeners()).toBe(0)
    expect(controller?.cameraListeners()).toBe(0)

    controller?.focusViewport.mockClear()
    source.emit([participant(2, { viewport: viewport({ x: 999, y: 999 }) })])
    press('Escape')

    expect(controller?.focusViewport).not.toHaveBeenCalled()
  })
})
