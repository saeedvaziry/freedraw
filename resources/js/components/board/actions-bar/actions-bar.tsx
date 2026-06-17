import * as React from 'react'
import {
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  Crosshair,
  Moon,
  Redo2,
  Scissors,
  Sun,
  Trash2,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip.js'
import { ExportMenu, type ExportFormat } from '../export-menu/export-menu.js'

export interface ActionsBarProps {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  hasClipboard: boolean
  canExport: boolean
  onUndo(): void
  onRedo(): void
  onDelete(): void
  onDuplicate(): void
  onCopy(): void
  onCut(): void
  onPaste(): void
  onExport(format: ExportFormat, transparent: boolean, dark: boolean): void
  onCopyToClipboard(): void
  theme: 'light' | 'dark'
  onToggleTheme(): void
  snapGuidesEnabled: boolean
  onToggleSnapGuides(): void
  compact?: boolean
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
  hasClipboard,
  canExport,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,
  onCopy,
  onCut,
  onPaste,
  onExport,
  onCopyToClipboard,
  theme,
  onToggleTheme,
  snapGuidesEnabled,
  onToggleSnapGuides,
  compact = false,
}: ActionsBarProps) {
  const actions: ActionDef[] = [
    { key: 'undo', label: 'Undo', Icon: Undo2, onClick: onUndo, disabled: !canUndo },
    { key: 'redo', label: 'Redo', Icon: Redo2, onClick: onRedo, disabled: !canRedo },
    { key: 'delete', label: 'Delete', Icon: Trash2, onClick: onDelete, disabled: !hasSelection },
    { key: 'duplicate', label: 'Duplicate', Icon: CopyPlus, onClick: onDuplicate, disabled: !hasSelection },
    { key: 'copy', label: 'Copy', Icon: ClipboardCopy, onClick: onCopy, disabled: !hasSelection },
    { key: 'cut', label: 'Cut', Icon: Scissors, onClick: onCut, disabled: !hasSelection },
    { key: 'paste', label: 'Paste', Icon: ClipboardPaste, onClick: onPaste, disabled: !hasClipboard },
  ]

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur',
          compact && 'max-w-full overflow-x-auto',
        )}
      >
        {actions.map(({ key, label, Icon, onClick, disabled }) => (
          <ActionButton key={key} label={label} onClick={onClick} disabled={disabled}>
            <Icon />
          </ActionButton>
        ))}
        <div className="mx-1 h-7 w-px shrink-0 bg-border" />
        <ActionButton
          label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </ActionButton>
        <ActionButton
          label={snapGuidesEnabled ? 'Hide guides' : 'Show guides'}
          aria-pressed={snapGuidesEnabled}
          className={snapGuidesEnabled ? 'bg-accent text-foreground' : undefined}
          onClick={onToggleSnapGuides}
        >
          <Crosshair />
        </ActionButton>
        <ExportMenu
          disabled={!canExport}
          theme={theme}
          onExport={onExport}
          onCopyToClipboard={onCopyToClipboard}
        />
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
