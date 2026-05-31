import * as React from 'react'
import { cn } from '../lib/utils.js'

const SWATCHES = [
  'transparent',
  '#1e1e1e',
  '#e03131',
  '#2f9e44',
  '#1971c2',
  '#f08c00',
  '#ae3ec9',
  '#ffffff',
]

export interface ColorPickerProps {
  label: string
  value: string
  allowTransparent?: boolean
  onChange(value: string): void
}

export function ColorPicker({ label, value, allowTransparent = false, onChange }: ColorPickerProps) {
  const swatches = allowTransparent ? SWATCHES : SWATCHES.filter((color) => color !== 'transparent')
  const isTransparent = value === 'transparent'

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground/70">{label}</span>
      <div className="flex items-center gap-1.5">
        <label
          className={cn(
            'relative h-7 w-7 shrink-0 overflow-hidden rounded-md border',
            isTransparent && 'bg-[conic-gradient(#ccc_25%,#fff_0_50%,#ccc_0_75%,#fff_0)] bg-[length:8px_8px]',
          )}
          style={isTransparent ? undefined : { backgroundColor: value }}
        >
          <input
            type="color"
            aria-label={`${label} color`}
            value={isTransparent ? '#ffffff' : value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`${label} ${color}`}
              aria-pressed={value === color}
              onClick={() => onChange(color)}
              className={cn(
                'h-5 w-5 rounded-md border transition-transform hover:scale-110',
                color === 'transparent' &&
                  'bg-[conic-gradient(#ccc_25%,#fff_0_50%,#ccc_0_75%,#fff_0)] bg-[length:8px_8px]',
                value === color && 'ring-2 ring-primary ring-offset-1',
              )}
              style={color === 'transparent' ? undefined : { backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
