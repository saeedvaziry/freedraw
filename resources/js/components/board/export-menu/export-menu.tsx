import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ClipboardCopy, Download, FileJson, ImageDown, Moon, Sun, Upload } from 'lucide-react'
import { EXPORT_DEFAULT_SCALE, shallowEqual } from '@freedraw/engine'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useBoardContext } from '../board-context.js'
import { SCENE_IMPORT_EVENT } from '../board-actions.js'

export type ExportFormat = 'png' | 'jpg'

export interface ExportMenuOptions {
  scale?: number
  selectionOnly?: boolean
}

const SCALES = [1, 2, 3]

export function ExportMenu() {
  const { store, boardExport, theme: boardTheme, readOnly } = useBoardContext()
  const [open, setOpen] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [dark, setDark] = useState(boardTheme === 'dark')
  const [scale, setScale] = useState(EXPORT_DEFAULT_SCALE)
  const [selectionOnly, setSelectionOnly] = useState(false)

  const view = useMemo(
    () =>
      store.select(
        (s) => ({
          canExport: s.getSnapshot().order.length > 0,
          hasSelection: s.getUiState().selectedIds.size > 0,
        }),
        { equals: shallowEqual, channels: ['doc', 'selection'] },
      ),
    [store],
  )
  const state = useSyncExternalStore(view.subscribe, view.getSnapshot)

  const options: ExportMenuOptions = {
    scale,
    selectionOnly: selectionOnly && state.hasSelection,
  }

  const runExport = (format: ExportFormat, formatTransparent: boolean): void => {
    setOpen(false)
    void boardExport.exportImage(format, formatTransparent, dark, options)
  }

  const runCopy = (): void => {
    setOpen(false)
    void boardExport.copyImage(options)
  }

  const runExportScene = (): void => {
    setOpen(false)
    boardExport.exportScene(options)
  }

  const pickSceneFile = (): void => {
    window.dispatchEvent(new Event(SCENE_IMPORT_EVENT))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Export"
              disabled={!state.canExport && readOnly}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 coarse:h-11 coarse:w-11 [&_svg]:size-4"
            >
              <ImageDown />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Export</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" sideOffset={12} className="w-60 rounded-2xl p-2">
        <div className="flex flex-col gap-1">
          <MenuItem
            Icon={Download}
            label="Export PNG"
            hint="⌘S"
            disabled={!state.canExport}
            onClick={() => runExport('png', transparent)}
          />
          <MenuItem
            Icon={Download}
            label="Export JPG"
            disabled={!state.canExport}
            onClick={() => runExport('jpg', false)}
          />
          <MenuItem
            Icon={FileJson}
            label="Export JSON"
            disabled={!state.canExport}
            onClick={runExportScene}
          />
          <MenuItem
            Icon={ClipboardCopy}
            label="Copy to clipboard"
            hint="⇧⌘C"
            disabled={!state.canExport}
            onClick={runCopy}
          />
          {!readOnly ? (
            <>
              <div className="my-1 h-px bg-border" />
              <MenuItem Icon={Upload} label="Import JSON" onClick={pickSceneFile} />
            </>
          ) : null}
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center justify-between px-3 py-2 text-sm text-foreground/80">
            <span>Theme</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
              <SegmentOption active={!dark} label="Light" onClick={() => setDark(false)}>
                <Sun />
                Light
              </SegmentOption>
              <SegmentOption active={dark} label="Dark" onClick={() => setDark(true)}>
                <Moon />
                Dark
              </SegmentOption>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-sm text-foreground/80">
            <span>Size</span>
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
              {SCALES.map((value) => (
                <SegmentOption
                  key={value}
                  active={scale === value}
                  label={`${value}x`}
                  onClick={() => setScale(value)}
                >
                  {value}x
                </SegmentOption>
              ))}
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
          <label
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/80',
              state.hasSelection ? 'cursor-pointer hover:bg-accent' : 'cursor-not-allowed opacity-40',
            )}
          >
            <span>Selection only</span>
            <input
              type="checkbox"
              checked={selectionOnly && state.hasSelection}
              disabled={!state.hasSelection}
              onChange={(event) => setSelectionOnly(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface SegmentOptionProps {
  active: boolean
  label: string
  children: ReactNode
  onClick(): void
}

function SegmentOption({ active, label, children, onClick }: SegmentOptionProps) {
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
      {children}
    </button>
  )
}

interface MenuItemProps {
  Icon: typeof Download
  label: string
  hint?: string
  disabled?: boolean
  onClick(): void
}

function MenuItem({ Icon, label, hint, disabled, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
      )}
    >
      <Icon />
      <span className="flex-1 text-left">{label}</span>
      {hint ? <span className="text-xs text-foreground/40">{hint}</span> : null}
    </button>
  )
}
