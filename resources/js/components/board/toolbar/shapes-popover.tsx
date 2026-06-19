import { Shapes } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js'
import { cn } from '@/lib/utils'
import { ToolButton } from './tool-button.js'
import { SHAPES, type ShapeEntry, type ShapeType } from './shapes.js'

export interface ShapesPopoverProps {
  open: boolean
  onOpenChange(open: boolean): void
  activeShapeType: ShapeType
  shapeToolActive: boolean
  onSelectShape(type: ShapeType): void
  /** Shapes to list in the popover. Defaults to the full set. */
  shapes?: ShapeEntry[]
  label?: string
}

export function ShapesPopover({
  open,
  onOpenChange,
  activeShapeType,
  shapeToolActive,
  onSelectShape,
  shapes = SHAPES,
  label = 'More shapes',
}: ShapesPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ToolButton label={label} active={shapeToolActive}>
          <Shapes />
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        className="w-auto rounded-2xl p-2"
      >
        <div className="grid grid-cols-4 gap-1">
          {shapes.map(({ type, label, Icon }) => (
            <button
              key={type}
              type="button"
              aria-label={label}
              aria-pressed={shapeToolActive && activeShapeType === type}
              onClick={() => onSelectShape(type)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4',
                shapeToolActive &&
                  activeShapeType === type &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              )}
            >
              <Icon />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
