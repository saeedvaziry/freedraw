import {
  BoxSelect,
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  Crosshair,
  Download,
  ImageDown,
  Maximize,
  Redo2,
  Scissors,
  SquareDashed,
  Trash2,
  Undo2,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import type { BoardExport } from '@/hooks/board/use-export.js'

export type BoardActionScope = 'canvas' | 'menu-open' | 'text-editing'

export type BoardActionGroup = 'history' | 'edit' | 'clipboard' | 'selection' | 'view' | 'export'

export interface BoardActionContext {
  store: SceneStore
  controller: EditorController | null
  boardExport: BoardExport
  theme: 'light' | 'dark'
  openImagePicker: () => void
}

export interface BoardAction {
  id: string
  label: string
  icon: LucideIcon
  group: BoardActionGroup
  shortcut?: string
  when(ctx: BoardActionContext): boolean
  run(ctx: BoardActionContext): void
  match?(event: KeyboardEvent): boolean
}

function usesMod(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

export const BOARD_ACTIONS: BoardAction[] = [
  {
    id: 'undo',
    label: 'Undo',
    icon: Undo2,
    group: 'history',
    shortcut: '⌘Z',
    when: ({ store }) => store.canUndo,
    run: ({ store }) => store.undo(),
    match: (event) => usesMod(event) && !event.shiftKey && event.key.toLowerCase() === 'z',
  },
  {
    id: 'redo',
    label: 'Redo',
    icon: Redo2,
    group: 'history',
    shortcut: '⇧⌘Z',
    when: ({ store }) => store.canRedo,
    run: ({ store }) => store.redo(),
    match: (event) => usesMod(event) && event.shiftKey && event.key.toLowerCase() === 'z',
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    group: 'edit',
    shortcut: '⌫',
    when: ({ store }) => store.getUiState().selectedIds.size > 0,
    run: ({ store }) => store.deleteElements(store.getUiState().selectedIds),
    match: (event) => event.key === 'Delete' || event.key === 'Backspace',
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyPlus,
    group: 'edit',
    shortcut: '⌘D',
    when: ({ store }) => store.getUiState().selectedIds.size > 0,
    run: ({ store }) => store.duplicateElements(store.getUiState().selectedIds),
    match: (event) => usesMod(event) && event.key.toLowerCase() === 'd',
  },
  {
    id: 'copy',
    label: 'Copy',
    icon: ClipboardCopy,
    group: 'clipboard',
    shortcut: '⌘C',
    when: ({ store }) => store.getUiState().selectedIds.size > 0,
    run: ({ store }) => {
      store.copyElements(store.getUiState().selectedIds)
    },
  },
  {
    id: 'cut',
    label: 'Cut',
    icon: Scissors,
    group: 'clipboard',
    shortcut: '⌘X',
    when: ({ store }) => store.getUiState().selectedIds.size > 0,
    run: ({ store }) => {
      store.cutElements(store.getUiState().selectedIds)
    },
  },
  {
    id: 'paste',
    label: 'Paste',
    icon: ClipboardPaste,
    group: 'clipboard',
    shortcut: '⌘V',
    when: ({ store }) => store.getUiState().clipboardElementCount > 0,
    run: ({ store, controller }) => {
      store.pasteElements({ target: controller?.cursorWorldPoint })
    },
  },
  {
    id: 'select-all',
    label: 'Select all',
    icon: BoxSelect,
    group: 'selection',
    shortcut: '⌘A',
    when: ({ store }) => store.getSnapshot().order.length > 0,
    run: ({ store }) => store.setUiState({ selectedIds: new Set(store.getSnapshot().order) }),
    match: (event) => usesMod(event) && event.key.toLowerCase() === 'a',
  },
  {
    id: 'deselect',
    label: 'Deselect',
    icon: SquareDashed,
    group: 'selection',
    when: ({ store }) => {
      const ui = store.getUiState()
      return ui.selectedIds.size > 0 || ui.activeTool !== 'select'
    },
    run: ({ store }) => store.setUiState({ selectedIds: new Set(), activeTool: 'select' }),
    match: (event) => event.key === 'Escape',
  },
  {
    id: 'zoom-to-fit',
    label: 'Zoom to fit',
    icon: Maximize,
    group: 'view',
    shortcut: '⌘1',
    when: ({ controller }) => controller != null,
    run: ({ controller }) => controller?.zoomToFit(),
    match: (event) => usesMod(event) && (event.key === '1' || event.key === '9'),
  },
  {
    id: 'zoom-actual-size',
    label: 'Actual size',
    icon: ZoomIn,
    group: 'view',
    shortcut: '⌘0',
    when: ({ controller }) => controller != null,
    run: ({ controller }) => controller?.zoomToActualSize(),
    match: (event) => usesMod(event) && event.key === '0',
  },
  {
    id: 'toggle-snap-guides',
    label: 'Snap guides',
    icon: Crosshair,
    group: 'view',
    when: () => true,
    run: ({ store }) => store.setSnapGuidesEnabled(!store.getSnapshot().appState.snapGuidesEnabled),
  },
  {
    id: 'export-png',
    label: 'Export PNG',
    icon: Download,
    group: 'export',
    shortcut: '⌘S',
    when: ({ store }) => store.getSnapshot().order.length > 0,
    run: ({ boardExport, theme }) => void boardExport.exportImage('png', false, theme === 'dark'),
    match: (event) => usesMod(event) && !event.shiftKey && event.key.toLowerCase() === 's',
  },
  {
    id: 'export-jpg',
    label: 'Export JPG',
    icon: Download,
    group: 'export',
    when: ({ store }) => store.getSnapshot().order.length > 0,
    run: ({ boardExport, theme }) => void boardExport.exportImage('jpg', false, theme === 'dark'),
  },
  {
    id: 'copy-image',
    label: 'Copy to clipboard',
    icon: ImageDown,
    group: 'export',
    shortcut: '⇧⌘C',
    when: ({ store }) => store.getSnapshot().order.length > 0,
    run: ({ boardExport }) => void boardExport.copyImage(),
    match: (event) => usesMod(event) && event.shiftKey && event.key.toLowerCase() === 'c',
  },
]

export const BOARD_ACTIONS_BY_ID: Record<string, BoardAction> = Object.fromEntries(
  BOARD_ACTIONS.map((action) => [action.id, action]),
)

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function isInsideOverlay(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('[data-radix-popper-content-wrapper], [role="dialog"]') != null
}

export function resolveActionScope(target: EventTarget | null): BoardActionScope {
  if (isEditableTarget(target)) return 'text-editing'
  if (isInsideOverlay(target)) return 'menu-open'
  return 'canvas'
}
