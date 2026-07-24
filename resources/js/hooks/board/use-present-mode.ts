import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorController, SceneStore, Slide } from '@freedraw/engine'

export interface PresentMode {
  active: boolean
  index: number
  count: number
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
  const activeRef = useRef(false)
  const indexRef = useRef(0)
  const slidesRef = useRef<Slide[]>([])
  const wasReadOnly = useRef(false)

  const frame = useCallback(
    (target: number) => {
      if (!controller) return
      const slide = slidesRef.current[target]
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

  return { active, index, count, enter, exit, next, previous, first, last }
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
