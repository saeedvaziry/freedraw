import { useState } from 'react'
import { ClipboardCopy, Download, ImageDown, Moon, Sun } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover.js'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.js'
import { cn } from '../lib/utils.js'

export type ExportFormat = 'png' | 'jpg'

export interface ExportMenuProps {
  disabled: boolean
  theme: 'light' | 'dark'
  onExport(format: ExportFormat, transparent: boolean, dark: boolean): void
  onCopyToClipboard(): void
}

export function ExportMenu({ disabled, theme, onExport, onCopyToClipboard }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [dark, setDark] = useState(theme === 'dark')

  const run = (action: () => void): void => {
    setOpen(false)
    action()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Export"
              disabled={disabled}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
            >
              <ImageDown />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Export</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" sideOffset={12} className="w-56 rounded-2xl p-2">
        <div className="flex flex-col gap-1">
          <MenuItem Icon={Download} label="Export PNG" hint="⌘S" onClick={() => run(() => onExport('png', transparent, dark))} />
          <MenuItem Icon={Download} label="Export JPG" onClick={() => run(() => onExport('jpg', false, dark))} />
          <MenuItem
            Icon={ClipboardCopy}
            label="Copy to clipboard"
            hint="⇧⌘C"
            onClick={() => run(onCopyToClipboard)}
          />
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center justify-between px-3 py-2 text-sm text-foreground/80">
            <span>Theme</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
              <ThemeOption active={!dark} label="Light" Icon={Sun} onClick={() => setDark(false)} />
              <ThemeOption active={dark} label="Dark" Icon={Moon} onClick={() => setDark(true)} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-accent">
            <span>Transparent (PNG)</span>
            <input
              type="checkbox"
              checked={transparent}
              onChange={(event) => setTransparent(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ThemeOptionProps {
  active: boolean
  label: string
  Icon: typeof Sun
  onClick(): void
}

function ThemeOption({ active, label, Icon, onClick }: ThemeOptionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground [&_svg]:size-3.5',
        active && 'bg-background text-foreground shadow-sm',
      )}
    >
      <Icon />
      {label}
    </button>
  )
}

interface MenuItemProps {
  Icon: typeof Download
  label: string
  hint?: string
  onClick(): void
}

function MenuItem({ Icon, label, hint, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4',
      )}
    >
      <Icon />
      <span className="flex-1 text-left">{label}</span>
      {hint ? <span className="text-xs text-foreground/40">{hint}</span> : null}
    </button>
  )
}
