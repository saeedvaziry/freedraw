import { useEffect, useState } from 'react'
import {
  BOARD_ACTIONS,
  resolveActionScope,
  type BoardAction,
  type BoardActionGroup,
} from './board-actions.js'
import { useBoardContext } from './board-context.js'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export const SHORTCUTS_SHEET_OPEN_EVENT = 'freedraw:shortcuts-open'

const GROUP_ORDER: BoardActionGroup[] = [
  'history',
  'edit',
  'clipboard',
  'selection',
  'view',
  'export',
]

const GROUP_LABELS: Record<BoardActionGroup, string> = {
  history: 'History',
  edit: 'Edit',
  clipboard: 'Clipboard',
  selection: 'Selection',
  view: 'View',
  export: 'Export',
}

const MODIFIER_KEYS = new Set(['⌘', '⇧', '⌥', '⌃'])

interface ShortcutGroup {
  group: BoardActionGroup
  label: string
  actions: BoardAction[]
}

function splitShortcut(shortcut: string): string[] {
  const keys: string[] = []
  let rest = ''

  for (const char of shortcut) {
    if (MODIFIER_KEYS.has(char)) {
      keys.push(char)
      continue
    }
    rest += char
  }

  if (rest !== '') keys.push(rest)
  return keys
}

function buildShortcutGroups(readOnly: boolean): ShortcutGroup[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    actions: BOARD_ACTIONS.filter(
      (action) =>
        action.group === group &&
        action.shortcut != null &&
        !(readOnly && action.requiresEdit === true),
    ),
  })).filter((entry) => entry.actions.length > 0)
}

const SHORTCUT_GROUPS = buildShortcutGroups(false)
const READ_ONLY_SHORTCUT_GROUPS = buildShortcutGroups(true)

interface ShortcutsSheetProps {
  open: boolean
  onOpenChange(open: boolean): void
  readOnly?: boolean
}

export function ShortcutsSheet({ open, onOpenChange, readOnly = false }: ShortcutsSheetProps) {
  const groups = readOnly ? READ_ONLY_SHORTCUT_GROUPS : SHORTCUT_GROUPS

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>Press ? on the canvas to open this list.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-3">
          {groups.map((entry) => (
            <section key={entry.group} className="mb-4 last:mb-0">
              <h3 className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {entry.label}
              </h3>
              <ul>
                {entry.actions.map((action) => {
                  const Icon = action.icon
                  return (
                    <li
                      key={action.id}
                      className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground"
                    >
                      <Icon className="size-4 shrink-0 text-foreground/70" />
                      <span className="flex-1 truncate">{action.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {splitShortcut(action.shortcut ?? '').map((key, index) => (
                          <kbd
                            key={`${key}-${index}`}
                            className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-sans text-xs font-medium text-muted-foreground dark:bg-muted/40"
                          >
                            {key}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function ShortcutsSheetHost() {
  const { readOnly } = useBoardContext()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key !== '?') return
      if (resolveActionScope(event.target) !== 'canvas') return
      event.preventDefault()
      setOpen(true)
    }
    const onOpenEvent = () => setOpen(true)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(SHORTCUTS_SHEET_OPEN_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(SHORTCUTS_SHEET_OPEN_EVENT, onOpenEvent)
    }
  }, [])

  return <ShortcutsSheet open={open} onOpenChange={setOpen} readOnly={readOnly} />
}
