import { Search } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import type { SceneStore } from '@freedraw/engine'
import {
  BOARD_ACTIONS,
  type BoardAction,
  type BoardActionContext,
  type BoardActionGroup,
} from '@/components/board/board-actions.js'
import { TIDY_ACTION } from '@/components/board/diagram-panel/tidy-action.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/components/board/ui-kit'
import { fuzzyMatch } from './fuzzy-match.js'

const EXCLUDED_IDS = new Set(['command.open'])

const PALETTE_ACTIONS: BoardAction[] = [...BOARD_ACTIONS, TIDY_ACTION]

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

const KEYWORD_DISCOUNT = 100

interface ScoredAction {
  action: BoardAction
  matched: number[]
  score: number
  order: number
}

interface RenderedItem {
  action: BoardAction
  matched: number[]
  index: number
}

interface RenderedGroup {
  group: BoardActionGroup
  label: string
  items: RenderedItem[]
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange(open: boolean): void
  context: BoardActionContext
}

function keywordsFor(action: BoardAction): string {
  return `${action.label} ${GROUP_LABELS[action.group]}`
}

function useStoreRevision(store: SceneStore, active: boolean): number {
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!active) return
    const bump = () => setRevision((value) => value + 1)
    const unsubscribers = [store.subscribe(bump), store.subscribeUi(bump), store.subscribeHistory(bump)]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [store, active])

  return revision
}

function scoreAction(query: string, action: BoardAction): { matched: number[]; score: number } | null {
  if (query === '') return { matched: [], score: 0 }

  const label = fuzzyMatch(query, action.label)
  if (label) return { matched: label.matched, score: label.score }

  const keyword = fuzzyMatch(query, keywordsFor(action))
  if (keyword) return { matched: [], score: keyword.score - KEYWORD_DISCOUNT }

  return null
}

function buildGroups(query: string, actions: BoardAction[]): RenderedGroup[] {
  const trimmed = query.trim()
  const byGroup = new Map<BoardActionGroup, ScoredAction[]>()

  actions.forEach((action, order) => {
    const result = scoreAction(trimmed, action)
    if (!result) return
    const bucket = byGroup.get(action.group) ?? []
    bucket.push({ action, matched: result.matched, score: result.score, order })
    byGroup.set(action.group, bucket)
  })

  const groups: RenderedGroup[] = []
  let index = 0

  for (const group of GROUP_ORDER) {
    const bucket = byGroup.get(group)
    if (!bucket || bucket.length === 0) continue
    bucket.sort((a, b) => (b.score - a.score) || (a.order - b.order))
    groups.push({
      group,
      label: GROUP_LABELS[group],
      items: bucket.map(({ action, matched }) => ({ action, matched, index: index++ })),
    })
  }

  return groups
}

function renderLabel(label: string, matched: number[]): ReactNode {
  if (matched.length === 0) return label

  const set = new Set(matched)
  const nodes: ReactNode[] = []
  let cursor = 0

  while (cursor < label.length) {
    const highlighted = set.has(cursor)
    let end = cursor
    while (end < label.length && set.has(end) === highlighted) end++
    const segment = label.slice(cursor, end)
    nodes.push(
      highlighted ? (
        <mark key={cursor} className="bg-transparent font-semibold text-foreground">
          {segment}
        </mark>
      ) : (
        <span key={cursor}>{segment}</span>
      ),
    )
    cursor = end
  }

  return nodes
}

export function CommandPalette({ open, onOpenChange, context }: CommandPaletteProps) {
  const revision = useStoreRevision(context.store, open)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const enabledActions = useMemo(
    () => PALETTE_ACTIONS.filter((action) => !EXCLUDED_IDS.has(action.id) && action.when(context)),
    [context, revision],
  )

  const groups = useMemo(() => buildGroups(query, enabledActions), [query, enabledActions])
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const activeIndex = flatItems.length === 0 ? -1 : Math.min(selectedIndex, flatItems.length - 1)

  useEffect(() => {
    if (activeIndex < 0) return
    const element = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    element?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const runAction = (action: BoardAction) => {
    onOpenChange(false)
    action.run(context)
  }

  const move = (delta: number) => {
    if (flatItems.length === 0) return
    setSelectedIndex((current) => {
      const base = current < 0 ? 0 : current
      return (base + delta + flatItems.length) % flatItems.length
    })
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = flatItems[activeIndex]
      if (item) runAction(item.action)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search board actions and run them.
        </DialogDescription>

        <div className="flex items-center gap-2 border-b border-border px-3 pr-10">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search actions…"
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="max-h-[min(24rem,55vh)] overflow-y-auto p-1.5"
        >
          {flatItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching actions</p>
          ) : (
            groups.map((group) => (
              <div key={group.group} className="mb-1 last:mb-0">
                <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map(({ action, matched, index }) => {
                  const Icon = action.icon
                  const selected = index === activeIndex
                  return (
                    <button
                      key={action.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-index={index}
                      onClick={() => runAction(action)}
                      onMouseMove={() => setSelectedIndex(index)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                        selected ? 'bg-accent text-foreground' : 'text-foreground/90',
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-foreground/70" />
                      <span className="flex-1 truncate">{renderLabel(action.label, matched)}</span>
                      {action.shortcut ? (
                        <kbd className="shrink-0 text-xs tracking-wide text-muted-foreground">
                          {action.shortcut}
                        </kbd>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
