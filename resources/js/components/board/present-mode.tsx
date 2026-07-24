import { ChevronLeft, ChevronRight, Presentation, X } from 'lucide-react'
import { FloatingPanel, IconButton } from '@/components/board/ui-kit'
import type { PresentMode } from '@/hooks/board/use-present-mode.js'

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

export function PresentOverlay({ present }: { present: PresentMode }) {
  const { index, count, next, previous, exit } = present
  const hasSlides = count > 0

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-center px-3">
      <FloatingPanel className="pointer-events-auto">
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
  )
}
