import {
  ChevronLeft,
  ChevronRight,
  Focus,
  Highlighter,
  Pause,
  Play,
  Presentation,
  RotateCcw,
  Timer,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { EditorController } from '@freedraw/engine'
import { Button, cn, FloatingPanel, IconButton } from '@/components/board/ui-kit'
import type { LaserToggleState } from './laser-toggle.js'
import { LASER_LABEL_OFF, LASER_LABEL_ON } from './laser-toggle.js'
import {
  usePresentTimer,
  type PresentMode,
  type SlideRect,
} from '@/hooks/board/use-present-mode.js'
import { useBoardContext } from './board-context.js'

export function PresentButton({ onEnter }: { onEnter: () => void }) {
  return (
    <FloatingPanel className="pointer-events-auto">
      <IconButton
        aria-label="Present"
        title="Present"
        onClick={onEnter}
        className="size-7 rounded-md text-foreground/70 coarse:size-7"
      >
        <Presentation className="size-4" />
      </IconButton>
    </FloatingPanel>
  )
}

export const LASER_KEY = 'l'

export interface PresentOverlayProps {
  present: PresentMode
  laser?: LaserToggleState
}

export function PresentOverlay({ present, laser }: PresentOverlayProps) {
  const { index, count, slideRect, next, previous, exit } = present
  const { controller } = useBoardContext()
  const [spotlight, setSpotlight] = useState(true)
  const timer = usePresentTimer()
  const hasSlides = count > 0
  const laserOn = laser?.active ?? false
  const laserAvailable = laser !== undefined && laser.available
  const toggleLaser = laser?.toggle

  useEffect(() => {
    if (!laserAvailable || toggleLaser === undefined) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== LASER_KEY) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      event.preventDefault()
      event.stopImmediatePropagation()
      toggleLaser()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [laserAvailable, toggleLaser])

  return (
    <>
      {spotlight && slideRect ? (
        <PresentSpotlight rect={slideRect} controller={controller} />
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-center px-3">
        <FloatingPanel className="pointer-events-auto max-w-full flex-wrap justify-center">
          {hasSlides ? (
            <>
              <IconButton
                aria-label="Previous slide"
                title="Previous"
                onClick={previous}
                disabled={index <= 0}
                className="size-8 rounded-md"
              >
                <ChevronLeft className="size-4" />
              </IconButton>
              <span className="min-w-16 px-1 text-center text-sm tabular-nums text-foreground/80">
                {index + 1} / {count}
              </span>
              <IconButton
                aria-label="Next slide"
                title="Next"
                onClick={next}
                disabled={index >= count - 1}
                className="size-8 rounded-md"
              >
                <ChevronRight className="size-4" />
              </IconButton>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            </>
          ) : (
            <span className="px-2 text-sm text-foreground/70">Presenting</span>
          )}
          {timer.visible ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Timer mode: ${timer.targetLabel}`}
                title={`${timer.targetLabel} — click to switch`}
                onClick={timer.cycleTarget}
                className={cn(
                  'px-2 tabular-nums',
                  timer.overtime ? 'text-destructive' : 'text-foreground/80',
                )}
              >
                {timer.label}
              </Button>
              <IconButton
                aria-label={timer.running ? 'Pause timer' : 'Start timer'}
                title={timer.running ? 'Pause timer' : 'Start timer'}
                onClick={timer.toggleRunning}
                className="size-8 rounded-md"
              >
                {timer.running ? <Pause className="size-4" /> : <Play className="size-4" />}
              </IconButton>
              <IconButton
                aria-label="Reset timer"
                title="Reset timer"
                onClick={timer.reset}
                className="size-8 rounded-md"
              >
                <RotateCcw className="size-4" />
              </IconButton>
            </>
          ) : null}
          <IconButton
            aria-label={timer.visible ? 'Hide timer' : 'Show timer'}
            title={timer.visible ? 'Hide timer' : 'Show timer'}
            active={timer.visible}
            onClick={timer.toggle}
            className="size-8 rounded-md"
          >
            <Timer className="size-4" />
          </IconButton>
          {laserAvailable ? (
            <IconButton
              aria-label={laserOn ? LASER_LABEL_ON : LASER_LABEL_OFF}
              title={`${laserOn ? LASER_LABEL_ON : LASER_LABEL_OFF} (L)`}
              active={laserOn}
              onClick={toggleLaser}
              className="size-8 rounded-md"
            >
              <Highlighter className="size-4" />
            </IconButton>
          ) : null}
          {hasSlides ? (
            <IconButton
              aria-label={spotlight ? 'Turn off spotlight' : 'Turn on spotlight'}
              title={spotlight ? 'Turn off spotlight' : 'Turn on spotlight'}
              active={spotlight}
              onClick={() => setSpotlight((on) => !on)}
              className="size-8 rounded-md"
            >
              <Focus className="size-4" />
            </IconButton>
          ) : null}
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <IconButton
            aria-label="Exit present mode"
            title="Exit (Esc)"
            onClick={exit}
            className="size-8 rounded-md"
          >
            <X className="size-4" />
          </IconButton>
        </FloatingPanel>
      </div>
    </>
  )
}

interface PresentSpotlightProps {
  rect: SlideRect
  controller: EditorController | null
}

const BAND_CLASS = 'absolute bg-slate-950/40 dark:bg-slate-950/65'
const HOST_CLASS =
  'pointer-events-none absolute inset-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200'

function PresentSpotlight({ rect, controller }: PresentSpotlightProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  const sync = useCallback(() => {
    const host = hostRef.current
    if (!host || !controller) return
    const view = controller.viewportSize
    const start = controller.worldToScreen({ x: rect.x, y: rect.y })
    const end = controller.worldToScreen({ x: rect.x + rect.width, y: rect.y + rect.height })
    const left = clamp(start.x, 0, view.width)
    const right = clamp(end.x, left, view.width)
    const top = clamp(start.y, 0, view.height)
    const bottom = clamp(end.y, top, view.height)
    host.style.setProperty('--spotlight-left', `${Math.round(left)}px`)
    host.style.setProperty('--spotlight-right', `${Math.round(right)}px`)
    host.style.setProperty('--spotlight-top', `${Math.round(top)}px`)
    host.style.setProperty('--spotlight-bottom', `${Math.round(bottom)}px`)
    host.style.setProperty('--spotlight-height', `${Math.round(bottom - top)}px`)
  }, [controller, rect])

  useLayoutEffect(() => {
    if (!controller) return
    sync()
    const detach = controller.subscribeCamera(sync)
    window.addEventListener('resize', sync)
    return () => {
      detach()
      window.removeEventListener('resize', sync)
    }
  }, [controller, sync])

  return (
    <div ref={hostRef} data-slot="present-spotlight" aria-hidden className={HOST_CLASS}>
      <div
        className={cn(BAND_CLASS, 'inset-x-0 top-0')}
        style={{ height: 'var(--spotlight-top)' }}
      />
      <div
        className={cn(BAND_CLASS, 'inset-x-0 bottom-0')}
        style={{ top: 'var(--spotlight-bottom)' }}
      />
      <div
        className={cn(BAND_CLASS, 'left-0')}
        style={{
          top: 'var(--spotlight-top)',
          height: 'var(--spotlight-height)',
          width: 'var(--spotlight-left)',
        }}
      />
      <div
        className={cn(BAND_CLASS, 'right-0')}
        style={{
          top: 'var(--spotlight-top)',
          height: 'var(--spotlight-height)',
          left: 'var(--spotlight-right)',
        }}
      />
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
