import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Workflow, type LucideIcon } from 'lucide-react'
import { Fragment, useState } from 'react'
import type { ContextMenuRequest, EditorController, ElementId, SpawnDirection } from '@freedraw/engine'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BOARD_ACTIONS_BY_ID, type BoardAction, type BoardActionContext } from '../board-actions.js'
import { useBoardContext } from '../board-context.js'

const GROUPS: string[][] = [
  ['copy', 'cut', 'paste'],
  ['duplicate', 'delete'],
  ['group', 'ungroup', 'lock', 'unlock'],
  ['order-front', 'order-forward', 'order-backward', 'order-back'],
  ['align-left', 'align-center-horizontal', 'align-right', 'align-top', 'align-middle-vertical', 'align-bottom'],
  ['distribute-horizontal', 'distribute-vertical'],
  ['select-all', 'deselect'],
  ['zoom-to-fit', 'zoom-actual-size', 'toggle-snap-guides', 'tool-lock.toggle'],
  ['export-png', 'export-jpg', 'copy-image'],
]

const CONNECTED_GROUP_INDEX = 1

const DIRECTIONS: { direction: SpawnDirection; label: string; Icon: LucideIcon }[] = [
  { direction: 'up', label: 'Up', Icon: ArrowUp },
  { direction: 'right', label: 'Right', Icon: ArrowRight },
  { direction: 'down', label: 'Down', Icon: ArrowDown },
  { direction: 'left', label: 'Left', Icon: ArrowLeft },
]

interface BoardContextMenuProps {
  request: ContextMenuRequest
  onClose(): void
}

export function BoardContextMenu({ request, onClose }: BoardContextMenuProps) {
  const board = useBoardContext()
  const [open, setOpen] = useState(true)

  const ctx: BoardActionContext = {
    store: board.store,
    controller: board.controller,
    boardExport: board.boardExport,
    theme: board.theme,
    openImagePicker: board.openImagePicker,
  }

  return (
    <DropdownMenu
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (next) return
        setOpen(false)
        onClose()
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none absolute"
          style={{ left: request.screen.x, top: request.screen.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={2}
        className="w-56"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {GROUPS.map((group, index) => {
          const actions = group
            .map((id) => BOARD_ACTIONS_BY_ID[id])
            .filter((action): action is BoardAction => action != null)
          if (actions.length === 0) return null
          return (
            <Fragment key={group.join('|')}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              {actions.map((action) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem
                    key={action.id}
                    disabled={!action.when(ctx)}
                    variant={action.id === 'delete' ? 'destructive' : 'default'}
                    onSelect={() => action.run(ctx)}
                  >
                    <Icon className="text-foreground/70" />
                    <span className="flex-1">{action.label}</span>
                    {action.shortcut ? (
                      <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
                    ) : null}
                  </DropdownMenuItem>
                )
              })}
              {index === CONNECTED_GROUP_INDEX && request.sourceId ? (
                <AddConnectedShape sourceId={request.sourceId} controller={board.controller} />
              ) : null}
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AddConnectedShape({
  sourceId,
  controller,
}: {
  sourceId: ElementId
  controller: EditorController | null
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2">
        <Workflow className="size-4 text-foreground/70" />
        <span className="flex-1">Add connected shape</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {DIRECTIONS.map(({ direction, label, Icon }) => (
          <DropdownMenuItem
            key={direction}
            onSelect={() => controller?.spawnChildAndEdit(sourceId, direction)}
          >
            <Icon className="text-foreground/70" />
            <span className="flex-1">{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
