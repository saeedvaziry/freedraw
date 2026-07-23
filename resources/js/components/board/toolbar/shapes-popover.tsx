import { Shapes } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js'
import { FloatingPanel } from '../ui/floating-panel.js'
import { IconButton } from '../ui/icon-button.js'
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
      <FloatingPanel asChild gap={false}>
        <PopoverContent side="top" align="end" sideOffset={12} className="w-auto">
          <div className="grid grid-cols-4 gap-[var(--panel-gap)]">
            {shapes.map(({ type, label, Icon }) => {
              const active = shapeToolActive && activeShapeType === type
              return (
                <IconButton
                  key={type}
                  aria-label={label}
                  aria-pressed={active}
                  active={active}
                  onClick={() => onSelectShape(type)}
                  className={cn(!active && 'text-foreground/80')}
                >
                  <Icon className="size-4" />
                </IconButton>
              )
            })}
          </div>
        </PopoverContent>
      </FloatingPanel>
    </Popover>
  )
}
