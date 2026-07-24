import { Pipette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FieldLabel } from './controls.js'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface Swatch {
  value: string
  token?: string
}

const SWATCHES: Swatch[] = [
  { value: 'transparent' },
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

function resolveSwatchColor(swatch: Swatch): string {
  if (!swatch.token) return swatch.value
  if (typeof window === 'undefined' || typeof document === 'undefined') return swatch.value
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(swatch.token)
    .trim()
  if (resolved === '' || resolved.includes('var(')) return swatch.value
  return resolved
}

function contrastColor(hex: string): string {
  const match = /^#?([\da-f]{6})$/i.exec(hex)
  if (!match) return '#1e1e1e'
  const int = parseInt(match[1]!, 16)
  const r = (int >> 16) & 0xff
  const g = (int >> 8) & 0xff
  const b = int & 0xff
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#1e1e1e' : '#ffffff'
}

export interface ColorPickerProps {
  label: string
  value: string
  allowTransparent?: boolean
  mixed?: boolean
  onChange(value: string): void
}

export function ColorPicker({
  label,
  value,
  allowTransparent = false,
  mixed = false,
  onChange,
}: ColorPickerProps) {
  const swatches = allowTransparent
    ? SWATCHES
    : SWATCHES.filter((swatch) => swatch.value !== 'transparent')
  const isTransparent = value === 'transparent'

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-medium tabular-nums text-foreground/80">
            {mixed ? 'Mixed' : isTransparent ? 'None' : value.toUpperCase()}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <label
                className={cn(
                  'relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded-md border coarse:h-7 coarse:w-7',
                  mixed || isTransparent ? TRANSPARENT_PATTERN : '',
                )}
                style={mixed || isTransparent ? undefined : { backgroundColor: value }}
              >
                <Pipette
                  className="size-3"
                  style={
                    mixed || isTransparent ? { color: '#1e1e1e' } : { color: contrastColor(value) }
                  }
                />
                <input
                  type="color"
                  aria-label={`${label} custom color`}
                  value={mixed || isTransparent ? '#ffffff' : value}
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
          const selected = !mixed && value === color
          return (
            <Tooltip key={swatch.value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} ${swatch.value}`}
                  aria-pressed={selected}
                  onClick={() => onChange(color)}
                  className={cn(
                    'h-6 w-full rounded-md border transition-transform hover:scale-110 coarse:h-9',
                    swatch.value === 'transparent' && TRANSPARENT_PATTERN,
                    selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                  )}
                  style={swatch.token ? { backgroundColor: `var(${swatch.token})` } : undefined}
                />
              </TooltipTrigger>
              <TooltipContent>
                {swatch.value === 'transparent' ? 'None' : color.toUpperCase()}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
