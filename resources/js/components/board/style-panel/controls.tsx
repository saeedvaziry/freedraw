import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip.js'

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-muted-foreground">{children}</span>
}

export interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  mixed?: boolean
  format?(value: number): string
  onChange(value: number): void
  onInteractStart?(): void
  onInteractEnd?(): void
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  mixed = false,
  format,
  onChange,
  onInteractStart,
  onInteractEnd,
}: SliderControlProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-xs font-medium tabular-nums text-foreground/80">
          {mixed ? 'Mixed' : (format ? format(value) : value)}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onInteractStart}
        onPointerUp={onInteractEnd}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
    </label>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
  Icon?: React.ComponentType<{ className?: string }>
  previewText?: string
  fontFamily?: string
}

export interface SegmentedControlProps<T extends string> {
  label: string
  value: T | null
  options: SegmentOption<T>[]
  onChange(value: T): void
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg border bg-muted/40 p-1">
        {options.map((option) => (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={option.label}
                aria-pressed={value === option.value}
                onClick={() => onChange(option.value)}
                style={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}
                className={cn(
                  'flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4',
                  value === option.value &&
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                )}
              >
                {option.Icon ? <option.Icon /> : (option.previewText ?? option.label)}
              </button>
            </TooltipTrigger>
            <TooltipContent>{option.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
