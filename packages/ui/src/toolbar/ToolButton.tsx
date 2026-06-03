import * as React from 'react'
import { cn } from '../lib/utils.js'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.js'

export interface ToolButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
  shortcut?: string
}

export const ToolButton = React.forwardRef<HTMLButtonElement, ToolButtonProps>(
  ({ label, active = false, shortcut, className, children, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={shortcut ? `${label} (${shortcut})` : label}
          aria-pressed={active}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4',
            active && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{shortcut ? `${label} (${shortcut})` : label}</TooltipContent>
    </Tooltip>
  ),
)
ToolButton.displayName = 'ToolButton'
