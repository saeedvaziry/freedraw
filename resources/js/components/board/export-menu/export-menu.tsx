import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ClipboardCopy, Download, FileJson, ImageDown, Moon, Sun, Upload } from 'lucide-react'
import {
  elementBounds,
  maxExportScale,
  shallowEqual,
  EXPORT_DEFAULT_PADDING,
  EXPORT_DEFAULT_SCALE,
  type ElementId,
  type SceneSnapshot,
} from '@freedraw/engine'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js'
import { FloatingPanel } from '../ui/floating-panel.js'
import { IconButton } from '../ui/icon-button.js'
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

function exportScaleLimit(snapshot: SceneSnapshot, ids: ReadonlySet<ElementId> | null): number {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const id of snapshot.order) {
    if (ids && !ids.has(id)) continue
    const element = snapshot.elements[id]
    if (!element) continue
    const bounds = elementBounds(element)
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  if (!Number.isFinite(minX)) return Infinity
  const padding = EXPORT_DEFAULT_PADDING * 2
  return maxExportScale(maxX - minX + padding, maxY - minY + padding)
}

export function ExportMenu() {
  const { store, boardExport, theme: boardTheme, readOnly } = useBoardContext()
  const [open, setOpen] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [dark, setDark] = useState(boardTheme === 'dark')
  const [scale, setScale] = useState(EXPORT_DEFAULT_SCALE)
  const [selectionOnly, setSelectionOnly] = useState(false)
  const scaleHintId = useId()

  const view = useMemo(
    () =>
      store.select(
        (s) => {
          const snapshot = s.getSnapshot()
          const selectedIds = s.getUiState().selectedIds
          const measure = open && snapshot.order.length > 0
          return {
            canExport: snapshot.order.length > 0,
            hasSelection: selectedIds.size > 0,
            sceneScaleLimit: measure ? exportScaleLimit(snapshot, null) : Infinity,
            selectionScaleLimit:
              measure && selectedIds.size > 0 ? exportScaleLimit(snapshot, selectedIds) : Infinity,
          }
        },
        { equals: shallowEqual, channels: ['doc', 'selection'] },
      ),
    [store, open],
  )
  const state = useSyncExternalStore(view.subscribe, view.getSnapshot)

  const scopedToSelection = selectionOnly && state.hasSelection
  const scaleLimit = scopedToSelection ? state.selectionScaleLimit : state.sceneScaleLimit
  const allowedScales = SCALES.filter((value) => value <= scaleLimit)
  const activeScale = allowedScales.includes(scale)
    ? scale
    : allowedScales.length > 0
      ? Math.max(...allowedScales)
      : SCALES[0]
  const scope = scopedToSelection ? 'Selection' : 'Board'
  const scaleHint =
    allowedScales.length === SCALES.length
      ? null
      : allowedScales.length === 0
        ? `${scope} too large to export at any size`
        : `${scope} too large above ${Math.max(...allowedScales)}x`

  const options: ExportMenuOptions = {
    scale: activeScale,
    selectionOnly: scopedToSelection,
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
            <IconButton
              aria-label="Export"
              disabled={!state.canExport && readOnly}
              className="text-foreground/80"
            >
              <ImageDown />
            </IconButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Export</TooltipContent>
      </Tooltip>
      <FloatingPanel asChild orientation="vertical" gap={false}>
        <PopoverContent side="top" align="end" sideOffset={12} className="w-60">
          <div className="flex w-full flex-col gap-1">
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
                <div className="my-1 h-px bg-[color:var(--panel-border)]" />
                <MenuItem Icon={Upload} label="Import JSON" onClick={pickSceneFile} />
              </>
            ) : null}
            <div className="my-1 h-px bg-[color:var(--panel-border)]" />
            <div className="flex items-center justify-between px-3 py-2 text-sm text-foreground/80">
              <span>Theme</span>
              <div className="flex items-center gap-0.5 rounded-[var(--control-radius)] bg-muted p-0.5">
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
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 text-sm text-foreground/80">
                <span>Size</span>
                <div className="flex items-center gap-0.5 rounded-[var(--control-radius)] bg-muted p-0.5">
                  {SCALES.map((value) => {
                    const unavailable = value > scaleLimit
                    return (
                      <SegmentOption
                        key={value}
                        active={activeScale === value}
                        disabled={unavailable}
                        describedBy={unavailable ? scaleHintId : undefined}
                        label={unavailable ? `${value}x (unavailable)` : `${value}x`}
                        onClick={() => setScale(value)}
                      >
                        {value}x
                      </SegmentOption>
                    )
                  })}
                </div>
              </div>
              {scaleHint ? (
                <p id={scaleHintId} className="px-3 pb-2 text-right text-xs text-foreground/50">
                  {scaleHint}
                </p>
              ) : null}
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
      </FloatingPanel>
    </Popover>
  )
}

interface SegmentOptionProps {
  active: boolean
  label: string
  disabled?: boolean
  describedBy?: string
  children: ReactNode
  onClick(): void
}

function SegmentOption({ active, label, disabled, describedBy, children, onClick }: SegmentOptionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      aria-describedby={describedBy}
      onClick={() => {
        if (!disabled) onClick()
      }}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground/70 transition-colors hover:text-foreground [&_svg]:size-3.5',
        active && 'bg-background text-foreground shadow-sm',
        disabled && 'cursor-not-allowed text-foreground/30 hover:text-foreground/30',
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
