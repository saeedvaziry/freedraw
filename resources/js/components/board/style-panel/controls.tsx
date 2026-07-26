import * as React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { IconButton } from '../ui/icon-button.js'
import { SegmentedControl as SegmentedControlPrimitive } from '../ui/segmented-control.js'

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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary coarse:h-3"
      />
    </label>
  )
}

export interface SegmentOption<T extends string | number> {
  value: T
  label: string
  Icon?: React.ComponentType<{ className?: string }>
  previewText?: string
  fontFamily?: string
}

export interface SegmentedControlProps<T extends string | number> {
  label: string
  value: T | null
  options: SegmentOption<T>[]
  onChange(value: T): void
}

export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <SegmentedControlPrimitive
        variant="solid"
        size="md"
        fill
        hint="tooltip"
        value={value}
        onChange={onChange}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
          Icon: option.Icon,
          text: option.Icon ? undefined : (option.previewText ?? option.label),
          fontFamily: option.fontFamily,
        }))}
      />
    </div>
  )
}

export const TOUCH_CONTROL_CLASS =
  'h-9 w-auto flex-1 rounded-[var(--icon-button-radius)] coarse:h-[var(--icon-button-size-coarse)]'

export interface ToggleControlProps {
  label: string
  pressed: boolean
  mixed?: boolean
  Icon: React.ComponentType<{ className?: string }>
  onChange(pressed: boolean): void
}

export function ToggleControl({
  label,
  pressed,
  mixed = false,
  Icon,
  onChange,
}: ToggleControlProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          size="sm"
          aria-label={label}
          active={pressed}
          data-mixed={mixed || undefined}
          onClick={() => onChange(!pressed)}
          className={TOUCH_CONTROL_CLASS}
        >
          <Icon />
        </IconButton>
      </TooltipTrigger>
      <TooltipContent>{mixed ? `${label} (mixed)` : label}</TooltipContent>
    </Tooltip>
  )
}
