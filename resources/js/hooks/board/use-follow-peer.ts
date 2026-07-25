import { useCallback, useEffect, useMemo, useState } from 'react'
import { clampZoom, type CameraState, type EditorController } from '@freedraw/engine'
import type { PresenceParticipant, PresenceViewport } from '@/lib/presence'
import type { PresencePeer } from './use-presence-roster.js'

export interface FollowPeerSource {
  active: boolean
  readParticipants(): PresenceParticipant[]
  subscribe(listener: () => void): () => void
}

export interface UseFollowPeerOptions {
  controller: EditorController | null
  source: FollowPeerSource
  peers: readonly PresencePeer[]
}

export interface UseFollowPeerResult {
  followingId: number | null
  peer: PresencePeer | null
  follow(clientId: number): void
  stop(): void
  toggle(clientId: number): void
}

const POSITION_EPSILON = 0.01
const ZOOM_EPSILON = 0.0001

export function cameraForPresenceViewport(
  viewport: PresenceViewport,
  size: { width: number; height: number },
): CameraState {
  if (size.width <= 0 || size.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { x: viewport.x, y: viewport.y, zoom: clampZoom(viewport.zoom) }
  }

  const zoom = clampZoom(Math.min(size.width / viewport.width, size.height / viewport.height))

  return {
    x: viewport.x + viewport.width / 2 - size.width / (2 * zoom),
    y: viewport.y + viewport.height / 2 - size.height / (2 * zoom),
    zoom,
  }
}

export function sameCamera(a: CameraState, b: CameraState): boolean {
  return (
    Math.abs(a.x - b.x) < POSITION_EPSILON &&
    Math.abs(a.y - b.y) < POSITION_EPSILON &&
    Math.abs(a.zoom - b.zoom) < ZOOM_EPSILON
  )
}

export function useFollowPeer({
  controller,
  source,
  peers,
}: UseFollowPeerOptions): UseFollowPeerResult {
  const [followingId, setFollowingId] = useState<number | null>(null)
  const { active, readParticipants, subscribe } = source

  const stop = useCallback(() => setFollowingId(null), [])
  const follow = useCallback((clientId: number) => setFollowingId(clientId), [])
  const toggle = useCallback(
    (clientId: number) => setFollowingId((current) => (current === clientId ? null : clientId)),
    [],
  )

  useEffect(() => {
    if (followingId === null) return

    if (!controller || !active) {
      setFollowingId(null)
      return
    }

    let released = false

    const release = (): void => {
      if (released) return
      released = true
      setFollowingId(null)
    }

    const apply = (): void => {
      if (released) return

      const target = readParticipants().find(
        (participant) => participant.clientId === followingId && !participant.isLocal,
      )

      if (!target) {
        release()
        return
      }

      if (!target.viewport) return

      const next = cameraForPresenceViewport(target.viewport, controller.viewportSize)
      if (sameCamera(controller.getViewport(), next)) return

      controller.focusViewport(next)
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') release()
    }

    const detachPresence = subscribe(apply)
    const detachCamera = controller.subscribeCameraInput(release)
    window.addEventListener('keydown', onKeyDown)
    apply()

    return () => {
      released = true
      detachPresence()
      detachCamera()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [active, controller, followingId, readParticipants, subscribe])

  const peer = useMemo(
    () => peers.find((candidate) => candidate.clientId === followingId) ?? null,
    [followingId, peers],
  )

  return { followingId, peer, follow, stop, toggle }
}
