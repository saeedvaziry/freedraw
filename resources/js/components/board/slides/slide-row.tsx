import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react'
import type { ElementId, Slide } from '@freedraw/engine'
import { Input } from '@/components/ui/input'
import { IconButton } from '@/components/board/ui-kit'

const ROW_ACTION_CLASS =
  'size-7 coarse:size-7 rounded-md text-foreground/70 hover:bg-background hover:text-foreground'

export interface SlideRowProps {
  slide: Slide
  index: number
  first: boolean
  last: boolean
  onRename(id: ElementId, name: string): void
  onDelete(id: ElementId): void
  onMove(id: ElementId, offset: number): void
}

export function SlideRow({
  slide,
  index,
  first,
  last,
  onRename,
  onDelete,
  onMove,
}: SlideRowProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (): void => {
    if (draft !== null) onRename(slide.id, draft)
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-accent px-2 py-1.5">
        <Input
          autoFocus
          value={draft}
          maxLength={120}
          spellCheck={false}
          aria-label={`Rename ${slide.name}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setDraft(null)
          }}
          className="h-8 min-w-0 flex-1 text-sm"
        />
        <IconButton
          aria-label={`Save name for ${slide.name}`}
          title="Save"
          className={ROW_ACTION_CLASS}
          onClick={commit}
        >
          <Check />
        </IconButton>
        <IconButton
          aria-label={`Cancel renaming ${slide.name}`}
          title="Cancel"
          className={ROW_ACTION_CLASS}
          onClick={() => setDraft(null)}
        >
          <X />
        </IconButton>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
      <span className="w-4 shrink-0 text-center text-xs tabular-nums text-foreground/50">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{slide.name}</p>
        <p className="truncate text-xs text-foreground/60">
          {Math.round(slide.rect.width)} × {Math.round(slide.rect.height)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton
          aria-label={`Move ${slide.name} up`}
          title="Move up"
          disabled={first}
          className={ROW_ACTION_CLASS}
          onClick={() => onMove(slide.id, -1)}
        >
          <ChevronUp />
        </IconButton>
        <IconButton
          aria-label={`Move ${slide.name} down`}
          title="Move down"
          disabled={last}
          className={ROW_ACTION_CLASS}
          onClick={() => onMove(slide.id, 1)}
        >
          <ChevronDown />
        </IconButton>
        <IconButton
          aria-label={`Rename ${slide.name}`}
          title="Rename"
          className={ROW_ACTION_CLASS}
          onClick={() => setDraft(slide.name)}
        >
          <Pencil />
        </IconButton>
        <IconButton
          aria-label={`Delete ${slide.name}`}
          title="Delete"
          className={ROW_ACTION_CLASS}
          onClick={() => onDelete(slide.id)}
        >
          <Trash2 />
        </IconButton>
      </div>
    </div>
  )
}
