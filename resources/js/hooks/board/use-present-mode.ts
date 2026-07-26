import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorController, SceneStore, Slide } from '@freedraw/engine'

export type SlideRect = Slide['rect']

export interface PresentMode {
  active: boolean
  index: number
  count: number
  slideRect: SlideRect | null
  enter: () => void
  exit: () => void
  next: () => void
  previous: () => void
  first: () => void
  last: () => void
}

export function usePresentMode(
  controller: EditorController | null,
  store: SceneStore,
): PresentMode {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)
  const [slideRect, setSlideRect] = useState<SlideRect | null>(null)
  const activeRef = useRef(false)
  const indexRef = useRef(0)
  const slidesRef = useRef<Slide[]>([])
  const wasReadOnly = useRef(false)

  const frame = useCallback(
    (target: number) => {
      const slide = slidesRef.current[target]
      setSlideRect(slide?.rect ?? null)
      if (!controller) return
      if (slide) controller.zoomToRect(slide.rect)
      else controller.zoomToFit()
    },
    [controller],
  )

  const goTo = useCallback(
    (target: number) => {
      const slides = slidesRef.current
      if (slides.length === 0) return
      const clamped = Math.max(0, Math.min(slides.length - 1, target))
      indexRef.current = clamped
      setIndex(clamped)
      frame(clamped)
    },
    [frame],
  )

  const enter = useCallback(() => {
    if (!controller || activeRef.current) return
    const slides = [...store.getSlides()].sort((a, b) => a.order - b.order)
    slidesRef.current = slides
    indexRef.current = 0
    setCount(slides.length)
    setIndex(0)
    wasReadOnly.current = controller.isReadOnly
    controller.setReadOnly(true)
    activeRef.current = true
    setActive(true)
    if (typeof document !== 'undefined') {
      void document.documentElement.requestFullscreen?.().catch(() => undefined)
    }
    frame(0)
  }, [controller, store, frame])

  const exit = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    setActive(false)
    setSlideRect(null)
    controller?.setReadOnly(wasReadOnly.current)
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined)
    }
  }, [controller])

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo])
  const previous = useCallback(() => goTo(indexRef.current - 1), [goTo])
  const first = useCallback(() => goTo(0), [goTo])
  const last = useCallback(() => goTo(slidesRef.current.length - 1), [goTo])

  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      const handled = handleKey(event.key, { next, previous, first, last, exit })
      if (!handled) return
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) exit()
    }

    window.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [active, next, previous, first, last, exit])

  return { active, index, count, slideRect, enter, exit, next, previous, first, last }
}

const TIMER_TARGETS = [0, 5, 10, 15, 20]

interface TimerClock {
  base: number
  startedAt: number | null
}

const STOPPED_CLOCK: TimerClock = { base: 0, startedAt: null }

export interface PresentTimer {
  visible: boolean
  running: boolean
  target: number
  targetLabel: string
  label: string
  overtime: boolean
  toggle: () => void
  toggleRunning: () => void
  reset: () => void
  cycleTarget: () => void
}

export function usePresentTimer(): PresentTimer {
  const [visible, setVisible] = useState(false)
  const [target, setTarget] = useState(0)
  const [clock, setClock] = useState<TimerClock>(STOPPED_CLOCK)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const { base, startedAt } = clock
    if (startedAt === null) {
      setElapsed(base)
      return
    }
    const tick = () => setElapsed(base + Date.now() - startedAt)
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [clock])

  const toggle = useCallback(() => {
    if (visible) {
      setVisible(false)
      setClock(STOPPED_CLOCK)
      return
    }
    setVisible(true)
    setClock({ base: 0, startedAt: Date.now() })
  }, [visible])

  const toggleRunning = useCallback(() => {
    setClock((current) =>
      current.startedAt === null
        ? { base: current.base, startedAt: Date.now() }
        : { base: current.base + Date.now() - current.startedAt, startedAt: null },
    )
  }, [])

  const reset = useCallback(() => {
    setClock((current) =>
      current.startedAt === null ? STOPPED_CLOCK : { base: 0, startedAt: Date.now() },
    )
  }, [])

  const cycleTarget = useCallback(() => {
    setTarget((minutes) => {
      const at = TIMER_TARGETS.indexOf(minutes)
      return TIMER_TARGETS[(at + 1) % TIMER_TARGETS.length] ?? 0
    })
    reset()
  }, [reset])

  const seconds =
    target === 0 ? Math.floor(elapsed / 1000) : Math.ceil((target * 60_000 - elapsed) / 1000)
  const overtime = seconds < 0

  return {
    visible,
    running: clock.startedAt !== null,
    target,
    targetLabel: target === 0 ? 'Elapsed' : `${target} min countdown`,
    label: `${overtime ? '-' : ''}${formatClock(Math.abs(seconds))}`,
    overtime,
    toggle,
    toggleRunning,
    reset,
    cycleTarget,
  }
}

function formatClock(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const tail = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${tail}` : tail
}

interface KeyActions {
  next: () => void
  previous: () => void
  first: () => void
  last: () => void
  exit: () => void
}

function handleKey(key: string, actions: KeyActions): boolean {
  switch (key) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      actions.next()
      return true
    case 'ArrowLeft':
    case 'PageUp':
      actions.previous()
      return true
    case 'Home':
      actions.first()
      return true
    case 'End':
      actions.last()
      return true
    case 'Escape':
      actions.exit()
      return true
    default:
      return false
  }
}
