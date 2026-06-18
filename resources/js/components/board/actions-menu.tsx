import {
  Check,
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  Crosshair,
  Download,
  ImageDown,
  Moon,
  Redo2,
  Scissors,
  Sun,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
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

interface ActionsMenuProps {
  store: SceneStore
  controller: EditorController | null
  boardExport: BoardExport
  theme: 'light' | 'dark'
  onToggleTheme(): void
  children: ReactNode
}

/**
 * The board editing actions (undo, redo, delete, … plus theme, snap guides and
 * export) as a vertical dropdown menu — one item per row — opening upward from
 * the bottom toolbar.
 */
export function ActionsMenu({
  store,
  controller,
  boardExport,
  theme,
  onToggleTheme,
  children,
}: ActionsMenuProps) {
  const canUndo = useSyncExternalStore(
    (cb) => store.subscribeHistory(cb),
    () => store.canUndo,
  )
  const canRedo = useSyncExternalStore(
    (cb) => store.subscribeHistory(cb),
    () => store.canRedo,
  )
  const ui = useSyncExternalStore(
    (cb) => store.subscribeUi(cb),
    () => store.getUiState(),
  )
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot(),
  )

  const hasSelection = ui.selectedIds.size > 0
  const hasClipboard = ui.clipboardElementCount > 0
  const canExport = snapshot.order.length > 0
  const snapGuidesEnabled = snapshot.appState.snapGuidesEnabled
  const { exportImage, copyImage } = boardExport

  const items: ActionRow[] = [
    { label: 'Undo', Icon: Undo2, shortcut: '⌘Z', disabled: !canUndo, onSelect: () => store.undo() },
    { label: 'Redo', Icon: Redo2, shortcut: '⇧⌘Z', disabled: !canRedo, onSelect: () => store.redo() },
    { label: 'Delete', Icon: Trash2, disabled: !hasSelection, onSelect: () => store.deleteElements(store.getUiState().selectedIds) },
    { label: 'Duplicate', Icon: CopyPlus, disabled: !hasSelection, onSelect: () => store.duplicateElements(store.getUiState().selectedIds) },
    { label: 'Copy', Icon: ClipboardCopy, disabled: !hasSelection, onSelect: () => store.copyElements(store.getUiState().selectedIds) },
    { label: 'Cut', Icon: Scissors, disabled: !hasSelection, onSelect: () => store.cutElements(store.getUiState().selectedIds) },
    { label: 'Paste', Icon: ClipboardPaste, disabled: !hasClipboard, onSelect: () => store.pasteElements({ target: controller?.cursorWorldPoint }) },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {items.map(({ label, Icon, shortcut, disabled, onSelect }) => (
          <DropdownMenuItem key={label} disabled={disabled} onSelect={onSelect}>
            <Icon className="text-foreground/70" />
            <span className="flex-1">{label}</span>
            {shortcut ? <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut> : null}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onToggleTheme}>
          {theme === 'dark' ? (
            <Sun className="text-foreground/70" />
          ) : (
            <Moon className="text-foreground/70" />
          )}
          <span className="flex-1">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            store.setSnapGuidesEnabled(!store.getSnapshot().appState.snapGuidesEnabled)
          }}
        >
          <Crosshair className="text-foreground/70" />
          <span className="flex-1">Snap guides</span>
          {snapGuidesEnabled ? <Check className="size-4 text-foreground/70" /> : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={!canExport}
          onSelect={() => void exportImage('png', false, theme === 'dark')}
        >
          <Download className="text-foreground/70" />
          <span className="flex-1">Export PNG</span>
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canExport}
          onSelect={() => void exportImage('jpg', false, theme === 'dark')}
        >
          <Download className="text-foreground/70" />
          <span className="flex-1">Export JPG</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canExport} onSelect={() => void copyImage()}>
          <ImageDown className="text-foreground/70" />
          <span className="flex-1">Copy to clipboard</span>
          <DropdownMenuShortcut>⇧⌘C</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ActionRow {
  label: string
  Icon: LucideIcon
  shortcut?: string
  disabled: boolean
  onSelect(): void
}
