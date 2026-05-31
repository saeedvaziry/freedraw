import * as React from 'react'
import { Copy, MoreHorizontal, Redo2, Trash2, Undo2 } from 'lucide-react'
import { cn } from '../lib/utils.js'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.js'

export interface ActionsBarProps {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  onUndo(): void
  onRedo(): void
  onDelete(): void
  onDuplicate(): void
}

interface ActionDef {
  key: string
  label: string
  Icon: typeof Undo2
  onClick(): void
  disabled: boolean
}

export function ActionsBar({
  canUndo,
  canRedo,
  hasSelection,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,
}: ActionsBarProps) {
  const actions: ActionDef[] = [
    { key: 'undo', label: 'Undo', Icon: Undo2, onClick: onUndo, disabled: !canUndo },
    { key: 'redo', label: 'Redo', Icon: Redo2, onClick: onRedo, disabled: !canRedo },
    { key: 'delete', label: 'Delete', Icon: Trash2, onClick: onDelete, disabled: !hasSelection },
    { key: 'duplicate', label: 'Duplicate', Icon: Copy, onClick: onDuplicate, disabled: !hasSelection },
  ]

  return (
    <TooltipProvider delayDuration={300}>
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
        {actions.map(({ key, label, Icon, onClick, disabled }) => (
          <ActionButton key={key} label={label} onClick={onClick} disabled={disabled}>
            <Icon />
          </ActionButton>
        ))}
        <div className="mx-1 h-7 w-px bg-border" />
        <ActionButton label="More" disabled>
          <MoreHorizontal />
        </ActionButton>
      </div>
    </TooltipProvider>
  )
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
}

function ActionButton({ label, className, children, ...props }: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
