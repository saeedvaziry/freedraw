import * as React from 'react'

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type SegmentedControlVariant = 'raised' | 'solid'
export type SegmentedControlSize = 'sm' | 'md'

export interface SegmentedControlOption<T> {
  value: T
  label: string
  Icon?: React.ComponentType<{ className?: string }>
  text?: React.ReactNode
  disabled?: boolean
  describedBy?: string
  fontFamily?: string
}

export interface SegmentedControlProps<T> {
  value: T | null
  options: SegmentedControlOption<T>[]
  onChange(value: T): void
  variant?: SegmentedControlVariant
  size?: SegmentedControlSize
  fill?: boolean
  hint?: 'tooltip' | 'title'
  ariaLabel?: string
  className?: string
}

const TRACK_VARIANT: Record<SegmentedControlVariant, string> = {
  raised: 'bg-muted',
  solid: 'border border-[color:var(--panel-border)] bg-muted/40',
}

const ACTIVE_VARIANT: Record<SegmentedControlVariant, string> = {
  raised: 'bg-background text-foreground shadow-sm',
  solid: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
}

const INACTIVE_VARIANT: Record<SegmentedControlVariant, string> = {
  raised: 'text-muted-foreground hover:text-foreground',
  solid: 'text-foreground/80 hover:bg-accent hover:text-foreground',
}

const SIZE_CLASS: Record<SegmentedControlSize, string> = {
  sm: 'py-1 [&_svg]:size-3.5',
  md: 'h-7 [&_svg]:size-4',
}

export function SegmentedControl<T extends string | number | boolean>({
  value,
  options,
  onChange,
  variant = 'raised',
  size = 'md',
  fill = false,
  hint,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const radiogroup = ariaLabel != null

  return (
    <div
      data-slot="segmented-control"
      role={radiogroup ? 'radiogroup' : undefined}
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-1 rounded-[var(--control-radius)] p-1',
        TRACK_VARIANT[variant],
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value
        const button = (
          <button
            key={String(option.value)}
            type="button"
            role={radiogroup ? 'radio' : undefined}
            aria-label={option.label}
            aria-pressed={radiogroup ? undefined : active}
            aria-checked={radiogroup ? active : undefined}
            aria-disabled={option.disabled || undefined}
            aria-describedby={option.describedBy}
            title={hint === 'title' ? option.label : undefined}
            onClick={() => {
              if (!option.disabled) onChange(option.value)
            }}
            style={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}
            data-slot="segmented-control-item"
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
              SIZE_CLASS[size],
              fill && 'flex-1',
              active ? ACTIVE_VARIANT[variant] : INACTIVE_VARIANT[variant],
              option.disabled && 'cursor-not-allowed text-foreground/30 hover:text-foreground/30',
            )}
          >
            {option.Icon ? <option.Icon /> : null}
            {option.text}
          </button>
        )

        if (hint === 'tooltip') {
          return (
            <Tooltip key={String(option.value)}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent>{option.label}</TooltipContent>
            </Tooltip>
          )
        }

        return button
      })}
    </div>
  )
}
