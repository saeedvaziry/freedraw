import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { IconButton } from '../ui/icon-button.js'

export interface ToolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  shortcut?: string
}

export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ label, active = false, shortcut, className, children, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          ref={ref}
          aria-label={shortcut ? `${label} (${shortcut})` : label}
          aria-pressed={active}
          active={active}
          className={cn(!active && 'text-foreground/80', className)}
          {...props}
        >
          {children}
        </IconButton>
      </TooltipTrigger>
      <TooltipContent>{shortcut ? `${label} (${shortcut})` : label}</TooltipContent>
    </Tooltip>
  ),
)
ToolButton.displayName = 'ToolButton'
