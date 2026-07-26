import { Plus, X } from 'lucide-react'
import type { ElementId, Slide } from '@freedraw/engine'
import { Button, cn, FloatingPanel, IconButton } from '@/components/board/ui-kit'
import { SlideRow } from './slide-row.js'

const HEADER_ACTION_CLASS = 'size-7 rounded-md text-foreground/70 coarse:size-7'

export interface SlidesPanelProps {
  slides: Slide[]
  canCreate: boolean
  className?: string
  onCreate(): void
  onRename(id: ElementId, name: string): void
  onDelete(id: ElementId): void
  onMove(id: ElementId, offset: number): void
  onClose(): void
}

export function SlidesPanel({
  slides,
  canCreate,
  className,
  onCreate,
  onRename,
  onDelete,
  onMove,
  onClose,
}: SlidesPanelProps) {
  return (
    <FloatingPanel
      orientation="vertical"
      gap={false}
      className={cn(
        'pointer-events-auto max-h-[calc(100vh-6rem)] w-[22rem] max-w-[calc(100vw-1.5rem)] gap-3 p-3',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Slides</span>
        <IconButton aria-label="Close slides" onClick={onClose} className={HEADER_ACTION_CLASS}>
          <X />
        </IconButton>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={!canCreate}
        onClick={onCreate}
        className="w-full gap-1.5"
      >
        <Plus className="size-4" />
        Add slide from selection
      </Button>

      {!canCreate ? (
        <p className="text-xs text-foreground/60">
          Select the elements you want to frame, then add them as a slide.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {slides.length === 0 ? (
          <p className="py-6 text-center text-xs text-foreground/60">No slides yet.</p>
        ) : null}

        {slides.map((slide, index) => (
          <SlideRow
            key={slide.id}
            slide={slide}
            index={index}
            first={index === 0}
            last={index === slides.length - 1}
            onRename={onRename}
            onDelete={onDelete}
            onMove={onMove}
          />
        ))}
      </div>

      <p className="border-t border-[color:var(--panel-border)] pt-2 text-[0.6875rem] leading-relaxed text-foreground/55">
        Present mode walks these slides top to bottom. With no slides it just fits the whole board.
      </p>
    </FloatingPanel>
  )
}
