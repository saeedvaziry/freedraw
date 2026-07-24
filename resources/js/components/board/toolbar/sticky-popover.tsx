import { StickyNote } from 'lucide-react'
import type { StickyColor } from '@freedraw/engine'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js'
import { FloatingPanel } from '../ui/floating-panel.js'
import { IconButton } from '../ui/icon-button.js'
import { cn } from '@/lib/utils'
import { ToolButton } from './tool-button.js'

interface StickyColorEntry {
  key: StickyColor
  label: string
  swatch: string
}

const STICKY_COLOR_ENTRIES: StickyColorEntry[] = [
  { key: 'yellow', label: 'Yellow', swatch: 'var(--canvas-sticky-yellow)' },
  { key: 'green', label: 'Green', swatch: 'var(--canvas-sticky-green)' },
  { key: 'blue', label: 'Blue', swatch: 'var(--canvas-sticky-blue)' },
  { key: 'pink', label: 'Pink', swatch: 'var(--canvas-sticky-pink)' },
  { key: 'orange', label: 'Orange', swatch: 'var(--canvas-sticky-orange)' },
  { key: 'purple', label: 'Purple', swatch: 'var(--canvas-sticky-purple)' },
]

export interface StickyPopoverProps {
  open: boolean
  onOpenChange(open: boolean): void
  active: boolean
  activeColor: StickyColor
  onSelectColor(color: StickyColor): void
  side?: 'right' | 'top'
}

export function StickyPopover({
  open,
  onOpenChange,
  active,
  activeColor,
  onSelectColor,
  side = 'right',
}: StickyPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <ToolButton label="Sticky note" shortcut="N" active={active}>
          <StickyNote />
        </ToolButton>
      </PopoverTrigger>
      <FloatingPanel asChild gap={false}>
        <PopoverContent side={side} align="start" sideOffset={12} className="w-auto">
          <div className="grid grid-cols-3 gap-1.5">
            {STICKY_COLOR_ENTRIES.map(({ key, label, swatch }) => (
              <IconButton
                key={key}
                aria-label={label}
                aria-pressed={active && activeColor === key}
                onClick={() => onSelectColor(key)}
                style={{ backgroundColor: swatch }}
                className={cn(
                  'border border-black/5 shadow-sm transition-transform hover:scale-110',
                  active &&
                    activeColor === key &&
                    'ring-2 ring-[color:var(--selection-accent)] ring-offset-1 ring-offset-background',
                )}
              />
            ))}
          </div>
        </PopoverContent>
      </FloatingPanel>
    </Popover>
  )
}
