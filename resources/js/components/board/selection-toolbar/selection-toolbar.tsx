import { ClipboardCopy, CopyPlus, MoreHorizontal, Pencil, Scissors, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  FloatingPanel,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@/components/board/ui-kit'

const QUICK_COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#ae3ec9'] as const

const MIXED_PATTERN =
  'bg-[conic-gradient(#ccc_25%,#fff_0_50%,#ccc_0_75%,#fff_0)] bg-[length:6px_6px]'

export interface SelectionToolbarProps {
  stroke: string | null
  canEdit: boolean
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
      <MoreMenu onCopy={onCopy} onCut={onCut} />
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
                'size-7 rounded-md border border-black/10 transition-transform hover:scale-110 dark:border-white/20',
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

function MoreMenu({ onCopy, onCut }: { onCopy(): void; onCut(): void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton aria-label="More actions" title="More">
          <MoreHorizontal />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={10} className="w-40 rounded-xl p-1">
        <MenuItem icon={ClipboardCopy} label="Copy" onClick={onCopy} />
        <MenuItem icon={Scissors} label="Cut" onClick={onCut} />
      </PopoverContent>
    </Popover>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick(): void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4"
    >
      <Icon />
      <span>{label}</span>
    </button>
  )
}
