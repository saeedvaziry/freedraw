import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FloatingPanel } from '../ui/floating-panel.js'
import { IconButton } from '../ui/icon-button.js'
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
    <FloatingPanel
      className={cn('pointer-events-auto', compact && 'max-w-full flex-wrap justify-center')}
    >
      {userMenu ? (
        <>
          {userMenu}
          <Divider />
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
      <Divider />
      <ActionButton
        label={snap.label}
        aria-pressed={snapGuidesEnabled}
        active={snapGuidesEnabled}
        disabled={!snap.when(ctx)}
        onClick={() => snap.run(ctx)}
      >
        <SnapIcon />
      </ActionButton>
      <ExportMenu />
    </FloatingPanel>
  )
}

function Divider() {
  return <div className="mx-1 h-7 w-px shrink-0 bg-[color:var(--panel-border)]" />
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  active?: boolean
}

function ActionButton({ label, active = false, className, children, ...props }: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          aria-label={label}
          active={active}
          className={cn(!active && 'text-foreground/80', className)}
          {...props}
        >
          {children}
        </IconButton>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
