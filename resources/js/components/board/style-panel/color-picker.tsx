import { Pipette } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { IconButton } from '../ui/icon-button.js'
import {
  contrastColor,
  displayColor,
  isTransparentKeyword,
  normalizeHex,
  TRANSPARENT,
} from './color.js'
import { FieldLabel } from './controls.js'
import {
  pickWithNativeEyeDropper,
  startCanvasEyeDropper,
  supportsNativeEyeDropper,
  type EyeDropperSession,
} from './eyedropper.js'
import { EMPTY_PALETTE, type PanelPalette } from './types.js'

interface Swatch {
  value: string
  token?: string
}

const SWATCHES: Swatch[] = [
  { value: TRANSPARENT },
  { value: '#1e1e1e', token: '--canvas-swatch-black' },
  { value: '#e03131', token: '--canvas-swatch-red' },
  { value: '#2f9e44', token: '--canvas-swatch-green' },
  { value: '#1971c2', token: '--canvas-swatch-blue' },
  { value: '#f08c00', token: '--canvas-swatch-orange' },
  { value: '#ae3ec9', token: '--canvas-swatch-purple' },
  { value: '#ffffff', token: '--canvas-swatch-white' },
]

const TRANSPARENT_PATTERN =
  'bg-[conic-gradient(#ccc_25%,#fff_0_50%,#ccc_0_75%,#fff_0)] bg-[length:8px_8px]'

const SWATCH_CLASS =
  'h-7 w-full rounded-md border border-[color:var(--panel-border)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] coarse:h-9'

const SELECTED_RING = 'ring-2 ring-[color:var(--selection-accent)] ring-offset-1 ring-offset-background'

function resolveSwatchColor(swatch: Swatch): string {
  if (!swatch.token) return swatch.value
  if (typeof window === 'undefined' || typeof document === 'undefined') return swatch.value
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(swatch.token)
    .trim()
  if (resolved === '' || resolved.includes('var(')) return swatch.value
  return resolved
}

function draftFor(value: string, mixed: boolean): string {
  if (mixed) return ''
  if (isTransparentKeyword(value)) return TRANSPARENT
  return normalizeHex(value) ?? value
}

export interface ColorPickerProps {
  label: string
  value: string
  allowTransparent?: boolean
  mixed?: boolean
  palette?: PanelPalette
  onChange(value: string): void
}

export function ColorPicker({
  label,
  value,
  allowTransparent = false,
  mixed = false,
  palette = EMPTY_PALETTE,
  onChange,
}: ColorPickerProps) {
  const swatches = allowTransparent
    ? SWATCHES
    : SWATCHES.filter((swatch) => swatch.value !== TRANSPARENT)
  const isTransparent = !mixed && isTransparentKeyword(value)

  const [draft, setDraft] = useState(() => draftFor(value, mixed))
  const [invalid, setInvalid] = useState(false)
  const [picking, setPicking] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const sessionRef = useRef<EyeDropperSession | null>(null)

  useEffect(() => {
    setDraft(draftFor(value, mixed))
    setInvalid(false)
  }, [value, mixed])

  useEffect(() => {
    return () => {
      sessionRef.current?.cancel()
      sessionRef.current = null
    }
  }, [])

  const endPicking = useCallback(() => {
    sessionRef.current = null
    setPicking(false)
    setPreview(null)
  }, [])

  const commitDraft = useCallback((): boolean => {
    const input = draft.trim()
    if (input === '') return false
    if (allowTransparent && isTransparentKeyword(input)) {
      setInvalid(false)
      onChange(TRANSPARENT)
      return true
    }
    const hex = normalizeHex(input)
    if (!hex) {
      setInvalid(true)
      return false
    }
    setInvalid(false)
    onChange(hex)
    return true
  }, [allowTransparent, draft, onChange])

  const startPicking = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    setPicking(true)
    if (supportsNativeEyeDropper()) {
      void pickWithNativeEyeDropper().then((color) => {
        setPicking(false)
        if (color) onChange(color)
      })
      return
    }
    sessionRef.current = startCanvasEyeDropper({
      onPick: (color) => {
        endPicking()
        onChange(color)
      },
      onPreview: setPreview,
      onCancel: endPicking,
    })
  }, [endPicking, onChange])

  const swatchValue = preview ?? value
  const showPattern = mixed || (isTransparent && !preview)
  const eyedropperLabel = supportsNativeEyeDropper()
    ? `Pick ${label.toLowerCase()} from screen`
    : `Pick ${label.toLowerCase()} from canvas`

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-medium tabular-nums text-foreground/80">
            {mixed ? 'Mixed' : displayColor(value)}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                className={cn(
                  'relative flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-[color:var(--panel-border)] coarse:size-9',
                  showPattern && TRANSPARENT_PATTERN,
                )}
                style={showPattern ? undefined : { backgroundColor: swatchValue }}
              >
                <input
                  type="color"
                  aria-label={`${label} custom color`}
                  value={showPattern ? '#ffffff' : (normalizeHex(swatchValue) ?? '#ffffff')}
                  onChange={(event) => onChange(event.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>Custom color</TooltipContent>
          </Tooltip>
        </span>
      </span>

      <div className={cn('grid gap-1.5', allowTransparent ? 'grid-cols-8' : 'grid-cols-7')}>
        {swatches.map((swatch) => {
          const color = resolveSwatchColor(swatch)
          const current = normalizeHex(value)
          const selected =
            !mixed &&
            (swatch.value === TRANSPARENT
              ? isTransparent
              : current !== null && current === normalizeHex(color))
          return (
            <Tooltip key={swatch.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} ${swatch.value}`}
                  aria-pressed={selected}
                  onClick={() => onChange(swatch.value === TRANSPARENT ? TRANSPARENT : color)}
                  className={cn(
                    SWATCH_CLASS,
                    swatch.value === TRANSPARENT && TRANSPARENT_PATTERN,
                    selected && SELECTED_RING,
                  )}
                  style={swatch.token ? { backgroundColor: `var(${swatch.token})` } : undefined}
                />
              </TooltipTrigger>
              <TooltipContent>
                {swatch.value === TRANSPARENT ? 'None' : color.toUpperCase()}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          aria-label={`${label} hex`}
          aria-invalid={invalid || undefined}
          placeholder={mixed ? 'Mixed' : '#000000'}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setInvalid(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitDraft()
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(draftFor(value, mixed))
              setInvalid(false)
            }
          }}
          onBlur={() => {
            if (commitDraft()) return
            setDraft(draftFor(value, mixed))
            setInvalid(false)
          }}
          className={cn(
            'h-9 min-w-0 flex-1 rounded-[var(--icon-button-radius)] border bg-transparent px-2 font-mono text-xs uppercase tabular-nums text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] coarse:h-[var(--icon-button-size-coarse)]',
            invalid
              ? 'border-[color:var(--destructive)] text-[color:var(--destructive)]'
              : 'border-[color:var(--panel-border)]',
          )}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              size="sm"
              aria-label={eyedropperLabel}
              active={picking}
              onClick={startPicking}
              className="flex-none coarse:size-[var(--icon-button-size-coarse)]"
            >
              <Pipette
                style={
                  picking && preview ? { color: contrastColor(preview) } : undefined
                }
              />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>{eyedropperLabel}</TooltipContent>
        </Tooltip>
      </div>

      <PaletteRow
        label="Recent"
        colors={palette.recent}
        selected={mixed ? null : normalizeHex(value)}
        onSelect={onChange}
      />
      <PaletteRow
        label="In use"
        colors={palette.document}
        selected={mixed ? null : normalizeHex(value)}
        onSelect={onChange}
      />
    </div>
  )
}

interface PaletteRowProps {
  label: string
  colors: string[]
  selected: string | null
  onSelect(color: string): void
}

function PaletteRow({ label, colors, selected, onSelect }: PaletteRowProps) {
  if (colors.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {colors.map((color) => (
          <Tooltip key={color}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${label} ${color}`}
                aria-pressed={selected === color}
                onClick={() => onSelect(color)}
                style={{ backgroundColor: color }}
                className={cn(
                  'size-6 shrink-0 rounded-md border border-[color:var(--panel-border)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] coarse:size-8',
                  selected === color && SELECTED_RING,
                )}
              />
            </TooltipTrigger>
            <TooltipContent>{color.toUpperCase()}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
