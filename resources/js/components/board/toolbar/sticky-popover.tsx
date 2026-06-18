import { StickyNote } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js'
import { cn } from '@/lib/utils'
import { ToolButton } from './tool-button.js'

export type StickyColorKey = 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple'

interface StickyColorEntry {
  key: StickyColorKey
  label: string
  swatch: string
}

const STICKY_COLOR_ENTRIES: StickyColorEntry[] = [
  { key: 'yellow', label: 'Yellow', swatch: '#fdf08a' },
  { key: 'green', label: 'Green', swatch: '#b9f6ca' },
  { key: 'blue', label: 'Blue', swatch: '#a7d8ff' },
  { key: 'pink', label: 'Pink', swatch: '#ffc4dd' },
  { key: 'orange', label: 'Orange', swatch: '#ffd8a8' },
  { key: 'purple', label: 'Purple', swatch: '#e0c3fc' },
]

export interface StickyPopoverProps {
  open: boolean
  onOpenChange(open: boolean): void
  active: boolean
  activeColor: StickyColorKey
  onSelectColor(color: StickyColorKey): void
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
      <PopoverContent side={side} align="start" sideOffset={12} className="w-auto rounded-2xl p-2">
        <div className="grid grid-cols-3 gap-1.5">
          {STICKY_COLOR_ENTRIES.map(({ key, label, swatch }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={active && activeColor === key}
              onClick={() => onSelectColor(key)}
              style={{ backgroundColor: swatch }}
              className={cn(
                'h-9 w-9 rounded-lg border border-black/5 shadow-sm transition-transform hover:scale-110',
                active &&
                  activeColor === key &&
                  'ring-2 ring-primary ring-offset-1 ring-offset-background',
              )}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
