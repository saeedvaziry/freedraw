import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type IconButtonSize = 'default' | 'sm'

const SIZE_CLASS: Record<IconButtonSize, string> = {
  default:
    'size-[var(--icon-button-size)] shrink-0 rounded-[var(--icon-button-radius)] coarse:size-[var(--icon-button-size-coarse)] focus-visible:ring-[color:var(--focus-ring)]',
  sm: 'size-9 shrink-0 rounded-[var(--icon-button-radius)] coarse:size-9 focus-visible:ring-[color:var(--focus-ring)]',
}

export interface IconButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'aria-label' | 'size'> {
  'aria-label': string
  active?: boolean
  size?: IconButtonSize
}

export function IconButton({
  active = false,
  size = 'default',
  variant = 'ghost',
  className,
  ...props
}: IconButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-pressed={active || undefined}
      className={cn(
        SIZE_CLASS[size],
        active &&
          'bg-[var(--selection-accent-weak)] text-[color:var(--selection-accent)] hover:bg-[var(--selection-accent-weak)] hover:text-[color:var(--selection-accent)]',
        className,
      )}
      {...props}
    />
  )
}
