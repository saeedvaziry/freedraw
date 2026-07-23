import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ExportMenu } from '../export-menu/export-menu.js'
import { BOARD_ACTIONS_BY_ID, type BoardActionContext } from '../board-actions.js'

const BAR_ACTION_IDS = ['undo', 'redo', 'delete', 'duplicate', 'copy', 'cut', 'paste']

export interface ActionsBarProps {
  ctx: BoardActionContext
  snapGuidesEnabled: boolean
  compact?: boolean
  userMenu?: React.ReactNode
}

export function ActionsBar({ ctx, snapGuidesEnabled, compact = false, userMenu }: ActionsBarProps) {
  const snap = BOARD_ACTIONS_BY_ID['toggle-snap-guides']
  const SnapIcon = snap.icon

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur',
          compact && 'max-w-full overflow-x-auto',
        )}
      >
        {userMenu ? (
          <>
            {userMenu}
            <div className="mx-1 h-7 w-px shrink-0 bg-border" />
          </>
        ) : null}
        {BAR_ACTION_IDS.map((id) => {
          const action = BOARD_ACTIONS_BY_ID[id]
          const Icon = action.icon
          return (
            <ActionButton
              key={id}
              label={action.label}
              disabled={!action.when(ctx)}
              onClick={() => action.run(ctx)}
            >
              <Icon />
            </ActionButton>
          )
        })}
        <div className="mx-1 h-7 w-px shrink-0 bg-border" />
        <ActionButton
          label={snap.label}
          aria-pressed={snapGuidesEnabled}
          className={snapGuidesEnabled ? 'bg-accent text-foreground' : undefined}
          disabled={!snap.when(ctx)}
          onClick={() => snap.run(ctx)}
        >
          <SnapIcon />
        </ActionButton>
        <ExportMenu />
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
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 coarse:h-11 coarse:w-11 [&_svg]:size-4',
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
