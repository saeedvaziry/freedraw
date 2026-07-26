import { usePage } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { ToolId } from '@freedraw/engine'
import {
  createPresenceRosterStore,
  createPresenceWriter,
  readPresenceParticipants,
  resolvePresenceIdentity,
  subscribePresence,
  type PresenceAwareness,
  type PresenceDrag,
  type PresenceIdentity,
  type PresenceLaserTrail,
  type PresenceParticipant,
  type PresencePoint,
  type PresenceRosterEntry,
  type PresenceUserInput,
  type PresenceViewport,
  type PresenceWriter,
} from '@/lib/presence'

export interface UsePresenceOptions {
  awareness: PresenceAwareness | null
  user?: PresenceUserInput | null
  enabled?: boolean
  readOnly?: boolean
  cursorIntervalMs?: number
  viewportIntervalMs?: number
  laserIntervalMs?: number
}

export interface UsePresenceResult {
  identity: PresenceIdentity
  active: boolean
  roster: PresenceRosterEntry[]
  readParticipants: () => PresenceParticipant[]
  subscribe: (listener: () => void) => () => void
  setCursor: (point: PresencePoint | null) => void
  setSelection: (ids: readonly string[]) => void
  setTool: (tool: ToolId | null) => void
  setViewport: (viewport: PresenceViewport | null) => void
  setDrag: (drag: PresenceDrag | null) => void
  setLaser: (laser: PresenceLaserTrail | null) => void
  flush: () => void
  clear: () => void
}

export function usePresence(options: UsePresenceOptions): UsePresenceResult {
  const {
    awareness,
    enabled = true,
    readOnly = false,
    cursorIntervalMs,
    viewportIntervalMs,
    laserIntervalMs,
  } = options
  const authUser = usePage().props.auth?.user ?? null
  const source = options.user !== undefined ? options.user : authUser
  const userId = source?.id ?? null
  const userName = source?.name ?? null
  const userAvatar = source?.avatar ?? null

  const identity = useMemo(
    () =>
      resolvePresenceIdentity({
        user: userId === null ? null : { id: userId, name: userName, avatar: userAvatar },
      }),
    [userId, userName, userAvatar],
  )

  const target = enabled ? awareness : null
  const writerRef = useRef<PresenceWriter | null>(null)
  const readOnlyRef = useRef(readOnly)

  useEffect(() => {
    if (!target) return

    const writer = createPresenceWriter(target, identity, {
      cursorIntervalMs,
      viewportIntervalMs,
      laserIntervalMs,
      readOnly: readOnlyRef.current,
    })
    writerRef.current = writer

    return () => {
      writer.destroy()
      if (writerRef.current === writer) writerRef.current = null
    }
  }, [target, identity, cursorIntervalMs, viewportIntervalMs, laserIntervalMs])

  useEffect(() => {
    readOnlyRef.current = readOnly
    writerRef.current?.setReadOnly(readOnly)
  }, [readOnly])

  const store = useMemo(() => createPresenceRosterStore(target), [target])
  const roster = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  const readParticipants = useCallback(() => readPresenceParticipants(target), [target])
  const subscribe = useCallback(
    (listener: () => void) => subscribePresence(target, listener),
    [target],
  )

  const setCursor = useCallback((point: PresencePoint | null) => {
    writerRef.current?.setCursor(point)
  }, [])
  const setSelection = useCallback((ids: readonly string[]) => {
    writerRef.current?.setSelection(ids)
  }, [])
  const setTool = useCallback((tool: ToolId | null) => {
    writerRef.current?.setTool(tool)
  }, [])
  const setViewport = useCallback((viewport: PresenceViewport | null) => {
    writerRef.current?.setViewport(viewport)
  }, [])
  const setDrag = useCallback((drag: PresenceDrag | null) => {
    writerRef.current?.setDrag(drag)
  }, [])
  const setLaser = useCallback((laser: PresenceLaserTrail | null) => {
    writerRef.current?.setLaser(laser)
  }, [])
  const flush = useCallback(() => {
    writerRef.current?.flush()
  }, [])
  const clear = useCallback(() => {
    writerRef.current?.clear()
  }, [])

  return {
    identity,
    active: target !== null,
    roster,
    readParticipants,
    subscribe,
    setCursor,
    setSelection,
    setTool,
    setViewport,
    setDrag,
    setLaser,
    flush,
    clear,
  }
}
