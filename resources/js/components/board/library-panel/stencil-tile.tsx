import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import {
  defaultAppState,
  renderStencilThumbnail,
  type SceneSnapshot,
  type Stencil,
} from '@freedraw/engine'
import { cn } from '@/lib/utils'
import { IconButton } from '../ui/icon-button.js'

const THUMBNAIL_CACHE = new Map<string, string | null>()

function resolveThumbnail(stencil: Stencil): string | null {
  if (stencil.thumbnail) return stencil.thumbnail
  const cached = THUMBNAIL_CACHE.get(stencil.id)
  if (cached !== undefined) return cached
  const ids = stencil.payload.elements.map((element) => element.id)
  const snapshot: SceneSnapshot = {
    elements: Object.fromEntries(stencil.payload.elements.map((element) => [element.id, element])),
    order: ids,
    appState: defaultAppState(),
  }
  const src = renderStencilThumbnail(snapshot, ids)
  THUMBNAIL_CACHE.set(stencil.id, src)
  return src
}

export interface StencilTileProps {
  stencil: Stencil
  onInsert(stencil: Stencil): void
  onRemove?(id: string): void
}

export function StencilTile({ stencil, onInsert, onRemove }: StencilTileProps) {
  const src = useMemo(() => resolveThumbnail(stencil), [stencil])
  const label = stencil.name || 'Untitled'

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onInsert(stencil)}
        title={label}
        aria-label={`Insert ${label}`}
        className="flex w-full flex-col gap-1 rounded-lg border border-[color:var(--panel-border)] bg-background p-1.5 text-left transition-colors hover:border-[color:var(--selection-accent)] focus-visible:border-[color:var(--selection-accent)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex h-16 w-full items-center justify-center overflow-hidden rounded-md bg-white p-1">
          {src ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-center text-xs font-medium text-neutral-700">{label}</span>
          )}
        </span>
        <span className="truncate text-xs text-foreground/70">{label}</span>
      </button>
      {onRemove ? (
        <IconButton
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
          onClick={() => onRemove(stencil.id)}
          className={cn(
            'absolute top-1 right-1 size-6 rounded-md bg-background/80 text-foreground/60 opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 coarse:size-6 coarse:opacity-100 [&_svg]:size-3.5',
          )}
        >
          <Trash2 />
        </IconButton>
      ) : null}
    </div>
  )
}
