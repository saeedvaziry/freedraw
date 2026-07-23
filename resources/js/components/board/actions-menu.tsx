import { Check } from 'lucide-react'
import { useSyncExternalStore, type ReactNode } from 'react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BoardExport } from '@/hooks/board/use-export.js'
import { BOARD_ACTIONS_BY_ID, type BoardAction, type BoardActionContext } from './board-actions.js'

interface ActionsMenuProps {
  store: SceneStore
  controller: EditorController | null
  boardExport: BoardExport
  theme: 'light' | 'dark'
  children: ReactNode
}

const EDIT_ACTION_IDS = ['undo', 'redo', 'delete', 'duplicate', 'copy', 'cut', 'paste']
const EXPORT_ACTION_IDS = ['export-png', 'export-jpg', 'copy-image']

export function ActionsMenu({
  store,
  controller,
  boardExport,
  theme,
  children,
}: ActionsMenuProps) {
  useSyncExternalStore(
    (cb) => store.subscribeHistory(cb),
    () => store.canUndo,
  )
  useSyncExternalStore(
    (cb) => store.subscribeHistory(cb),
    () => store.canRedo,
  )
  useSyncExternalStore(
    (cb) => store.subscribeUi(cb),
    () => store.getUiState(),
  )
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot(),
  )

  const snapGuidesEnabled = snapshot.appState.snapGuidesEnabled
  const snapAction = BOARD_ACTIONS_BY_ID['toggle-snap-guides']
  const SnapIcon = snapAction.icon

  const ctx: BoardActionContext = {
    store,
    controller,
    boardExport,
    theme,
    openImagePicker: () => {},
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {EDIT_ACTION_IDS.map((id) => (
          <ActionMenuRow key={id} action={BOARD_ACTIONS_BY_ID[id]} ctx={ctx} />
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            snapAction.run(ctx)
          }}
        >
          <SnapIcon className="text-foreground/70" />
          <span className="flex-1">{snapAction.label}</span>
          {snapGuidesEnabled ? <Check className="size-4 text-foreground/70" /> : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {EXPORT_ACTION_IDS.map((id) => (
          <ActionMenuRow key={id} action={BOARD_ACTIONS_BY_ID[id]} ctx={ctx} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ActionMenuRowProps {
  action: BoardAction
  ctx: BoardActionContext
}

function ActionMenuRow({ action, ctx }: ActionMenuRowProps) {
  const Icon = action.icon
  return (
    <DropdownMenuItem disabled={!action.when(ctx)} onSelect={() => action.run(ctx)}>
      <Icon className="text-foreground/70" />
      <span className="flex-1">{action.label}</span>
      {action.shortcut ? <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  )
}
