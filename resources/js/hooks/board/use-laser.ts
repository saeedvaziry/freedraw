import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorController } from '@freedraw/engine'
import { createLaserStore, type LaserStore, type PresenceLaserSource } from '@/lib/presence'

const FRAME_MS = 16

export interface UseLaserOptions {
  controller: EditorController | null
  readOnly?: boolean
  now?: () => number
}

export interface LaserPointer {
  active: boolean
  available: boolean
  toggle: () => void
  activate: () => void
  deactivate: () => void
  source: PresenceLaserSource | null
  store: LaserStore
}

function isCanvasTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.tagName === 'CANVAS'
}

function schedule(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(() => callback())
    return () => cancelAnimationFrame(id)
  }
  const id = setTimeout(callback, FRAME_MS)
  return () => clearTimeout(id)
}

export function useLaser(options: UseLaserOptions): LaserPointer {
  const { controller, readOnly = false, now } = options
  const clock = useRef(now)
  clock.current = now
  const store = useMemo(
    () => createLaserStore({ now: () => (clock.current ?? Date.now)() }),
    [],
  )
  const [active, setActive] = useState(false)
  const available = !readOnly
  const armed = active && available && controller !== null

  const activate = useCallback(() => {
    if (readOnly) return
    setActive(true)
  }, [readOnly])
  const deactivate = useCallback(() => setActive(false), [])
  const toggle = useCallback(() => {
    if (readOnly) return
    setActive((on) => !on)
  }, [readOnly])

  useEffect(() => {
    if (available) return
    setActive(false)
  }, [available])

  useEffect(() => {
    if (!armed || !controller) {
      store.clear()
      return
    }

    let cancel: (() => void) | null = null

    const tick = (): void => {
      cancel = null
      store.prune()
      if (!store.isEmpty()) pump()
    }
    const pump = (): void => {
      if (cancel !== null) return
      cancel = schedule(tick)
    }
    const trace = (point: { x: number; y: number } | null): void => {
      if (point === null) return
      store.push(point)
      pump()
    }
    const suppress = (event: PointerEvent | MouseEvent): void => {
      if (event.button !== 0 || !isCanvasTarget(event.target)) return
      event.preventDefault()
      event.stopPropagation()
    }
    const release = (): void => store.clear()
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') release()
    }

    const detach = controller.subscribeCursor(trace)
    window.addEventListener('pointerdown', suppress, true)
    window.addEventListener('dblclick', suppress, true)
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVisibility)

    const seed = controller.cursorWorldPoint
    if (seed !== null) trace(seed)

    return () => {
      cancel?.()
      detach()
      window.removeEventListener('pointerdown', suppress, true)
      window.removeEventListener('dblclick', suppress, true)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
      store.clear()
    }
  }, [armed, controller, store])

  return {
    active: armed,
    available,
    toggle,
    activate,
    deactivate,
    source: armed ? store : null,
    store,
  }
}
