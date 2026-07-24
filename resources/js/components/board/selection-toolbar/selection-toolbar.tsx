import { CopyPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Fragment } from 'react'
import {
  FloatingPanel,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@/components/board/ui-kit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BOARD_ACTIONS_BY_ID, type BoardAction, type BoardActionContext } from '../board-actions.js'

const QUICK_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#ae3ec9'] as const

const MIXED_PATTERN =
  'bg-[conic-gradient(#ccc_25%,#fff_0_50%,#ccc_0_75%,#fff_0)] bg-[length:6px_6px]'

export const SELECTION_ACTION_GROUPS: string[][] = [
  ['group', 'ungroup', 'lock', 'unlock-selection'],
  [
    'align-left',
    'align-center-horizontal',
    'align-right',
    'align-top',
    'align-middle-vertical',
    'align-bottom',
  ],
  ['order-front', 'order-forward', 'order-backward', 'order-back'],
]

export interface SelectionToolbarProps {
  stroke: string | null
  canEdit: boolean
  actionContext: BoardActionContext
  onPickColor(color: string): void
  onEdit(): void
  onDuplicate(): void
  onDelete(): void
  onCopy(): void
  onCut(): void
}

export function SelectionToolbar({
  stroke,
  canEdit,
  actionContext,
  onPickColor,
  onEdit,
  onDuplicate,
  onDelete,
  onCopy,
  onCut,
}: SelectionToolbarProps) {
  return (
    <FloatingPanel className="pointer-events-auto">
      <ColorButton stroke={stroke} onPick={onPickColor} />
      {canEdit ? (
        <IconButton aria-label="Edit" title="Edit" onClick={onEdit}>
          <Pencil />
        </IconButton>
      ) : null}
      <IconButton aria-label="Duplicate" title="Duplicate" onClick={onDuplicate}>
        <CopyPlus />
      </IconButton>
      <IconButton
        aria-label="Delete"
        title="Delete"
        onClick={onDelete}
        className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
      >
        <Trash2 />
      </IconButton>
      <MoreMenu actionContext={actionContext} onCopy={onCopy} onCut={onCut} />
    </FloatingPanel>
  )
}

function ColorButton({ stroke, onPick }: { stroke: string | null; onPick(color: string): void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton aria-label="Color" title="Color">
          <span
            className={cn(
              'size-4 rounded-full border border-black/10 dark:border-white/20',
              stroke ? '' : MIXED_PATTERN,
            )}
            style={stroke ? { backgroundColor: stroke } : undefined}
          />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={10} className="w-auto rounded-xl p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {QUICK_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Color ${color}`}
              aria-pressed={stroke === color}
              onClick={() => onPick(color)}
              style={{ backgroundColor: color }}
              className={cn(
                'size-7 rounded-md border border-black/10 transition-transform hover:scale-110 coarse:size-9 dark:border-white/20',
                stroke === color &&
                  'ring-2 ring-[color:var(--focus-ring)] ring-offset-1 ring-offset-background',
              )}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MoreMenu({
  actionContext,
  onCopy,
  onCut,
}: {
  actionContext: BoardActionContext
  onCopy(): void
  onCut(): void
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label="More actions" title="More">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={10} className="w-52 rounded-xl">
        <ActionItem action={BOARD_ACTIONS_BY_ID['copy']} ctx={actionContext} onSelect={onCopy} />
        <ActionItem action={BOARD_ACTIONS_BY_ID['cut']} ctx={actionContext} onSelect={onCut} />
        {SELECTION_ACTION_GROUPS.map((group) => (
          <Fragment key={group.join('|')}>
            <DropdownMenuSeparator />
            {group.map((id) => (
              <ActionItem key={id} action={BOARD_ACTIONS_BY_ID[id]} ctx={actionContext} />
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActionItem({
  action,
  ctx,
  onSelect,
}: {
  action: BoardAction
  ctx: BoardActionContext
  onSelect?(): void
}) {
  const Icon = action.icon
  return (
    <DropdownMenuItem
      disabled={!action.when(ctx)}
      onSelect={() => (onSelect ? onSelect() : action.run(ctx))}
    >
      <Icon className="text-foreground/70" />
      <span className="flex-1">{action.label}</span>
      {action.shortcut ? <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  )
}
