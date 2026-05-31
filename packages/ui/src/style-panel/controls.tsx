import * as React from 'react'
import { cn } from '../lib/utils.js'

export interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
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
  onChange,
  onInteractStart,
  onInteractEnd,
}: SliderControlProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground/70">{label}</span>
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
      <span className="text-xs font-medium text-foreground/70">{label}</span>
      <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-7 flex-1 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-accent [&_svg]:size-4',
              value === option.value && 'bg-background text-foreground shadow-sm',
            )}
          >
            {option.Icon ? <option.Icon /> : option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
