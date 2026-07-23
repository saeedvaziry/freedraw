import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'

import { cn } from '@/lib/utils'

export type FloatingPanelOrientation = 'horizontal' | 'vertical'

export interface FloatingPanelProps extends React.ComponentProps<'div'> {
  orientation?: FloatingPanelOrientation
  padding?: boolean
  gap?: boolean
  asChild?: boolean
}

export function FloatingPanel({
  orientation = 'horizontal',
  padding = true,
  gap = true,
  asChild = false,
  className,
  ...props
}: FloatingPanelProps) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      data-slot="floating-panel"
      className={cn(
        'flex rounded-[var(--panel-radius)] border border-[color:var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--panel-shadow)] backdrop-blur-[var(--panel-blur)]',
        orientation === 'vertical' ? 'flex-col' : 'flex-row items-center',
        padding && 'p-[var(--panel-padding)]',
        gap && 'gap-[var(--panel-gap)]',
        className,
      )}
      {...props}
    />
  )
}
