import { PanelRightClose, SlidersHorizontal } from 'lucide-react'
import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import type { ArrowElement, Element, SceneStore, SelectionStyle } from '@freedraw/engine'
import {
  StylePanel,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type ArrowPanelPatch,
  type ArrowPanelState,
  type PanelStyle,
  type PanelStylePatch,
  type StylePanelSelection,
} from '@/components/board/ui-kit'

interface StylePanelHostProps {
  store: SceneStore
  /**
   * When true (desktop), the panel can collapse to a single icon button in the
   * corner. On mobile the panel already lives inside a toggled popover, so it is
   * always rendered in full.
   */
  collapsible?: boolean
}

const COLLAPSE_KEY = 'freedraw:style-panel'

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(COLLAPSE_KEY) === 'collapsed'
}

interface PanelSnapshot {
  selection: StylePanelSelection
  style: PanelStyle
  arrow: ArrowPanelState
}

const FILL_LESS = new Set(['arrow', 'line', 'text'])
const DEFAULT_SELECTION: StylePanelSelection = {
  hasShape: true,
  hasFill: true,
  hasRoundness: true,
  hasText: true,
  hasArrow: false,
}

export function StylePanelHost({ store, collapsible = false }: StylePanelHostProps) {
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribeStyle(cb),
    () => readSnapshot(store),
  )

  // Collapsed-to-icon state, persisted like the left sidebar and read
  // synchronously on mount so it never flickers open on reload.
  const [collapsed, setCollapsed] = useState<boolean>(() => collapsible && readCollapsed())
  useLayoutEffect(() => {
    if (collapsible) window.localStorage.setItem(COLLAPSE_KEY, collapsed ? 'collapsed' : 'expanded')
  }, [collapsible, collapsed])

  const collapse = useCallback(() => setCollapsed(true), [])
  const expand = useCallback(() => setCollapsed(false), [])

  const updateStyle = (patch: PanelStylePatch): void => {
    const selectedIds = store.getUiState().selectedIds
    if (selectedIds.size === 0) {
      store.updateLastUsedStyle(patch)
      return
    }
    store.updateStyle(selectedIds, patch)
  }

  const updateArrow = (patch: ArrowPanelPatch): void => {
    const selectedIds = store.getUiState().selectedIds
    if (selectedIds.size === 0) return
    store.updateArrowheads(selectedIds, patch)
  }

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={expand}
              aria-label="Show style panel"
              className="pointer-events-auto flex size-10 items-center justify-center rounded-xl border bg-background/95 text-foreground/70 shadow-lg backdrop-blur transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-5"
            >
              <SlidersHorizontal />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Style</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <StylePanel
      selection={snapshot.selection}
      style={snapshot.style}
      arrow={snapshot.arrow}
      onStyleChange={updateStyle}
      onArrowChange={updateArrow}
      onInteractStart={() => store.stopCapturing()}
      onInteractEnd={() => store.stopCapturing()}
      header={collapsible ? <PanelHeader onCollapse={collapse} /> : undefined}
    />
  )
}

function PanelHeader({ onCollapse }: { onCollapse(): void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">Style</span>
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Collapse style panel"
        title="Collapse style panel"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4"
      >
        <PanelRightClose />
      </button>
    </div>
  )
}

const cache = new WeakMap<SceneStore, { key: string; value: PanelSnapshot }>()

function readSnapshot(store: SceneStore): PanelSnapshot {
  const ui = store.getUiState()
  const selectionStyle = store.getSelectionStyle()
  const selected = [...ui.selectedIds]
    .map((id) => store.getSnapshot().elements[id])
    .filter((element): element is Element => Boolean(element))

  const selection = selected.length === 0 ? DEFAULT_SELECTION : deriveSelection(selected)
  const arrow = deriveArrow(selected)
  const key = snapshotKey(selectionStyle, selection, arrow)

  const previous = cache.get(store)
  if (previous && previous.key === key) return previous.value

  const value: PanelSnapshot = {
    selection,
    style: selectionStyle as PanelStyle,
    arrow,
  }
  cache.set(store, { key, value })
  return value
}

function deriveSelection(selected: Element[]): StylePanelSelection {
  let hasShape = false
  let hasFill = false
  let hasRoundness = false
  let hasText = false
  let hasArrow = false
  for (const element of selected) {
    if (element.type === 'arrow' || element.type === 'line') {
      hasArrow = true
      hasRoundness = true
      continue
    }
    hasShape = true
    if (!FILL_LESS.has(element.type)) hasFill = true
    hasText = true
    if (isRoundable(element.type)) hasRoundness = true
  }
  return { hasShape, hasFill, hasRoundness, hasText, hasArrow }
}

function isRoundable(type: string): boolean {
  return type === 'rect' || type === 'roundRect' || type === 'image' || type === 'sticky'
}

function deriveArrow(selected: Element[]): ArrowPanelState {
  const arrows = selected.filter(
    (element): element is ArrowElement => element.type === 'arrow' || element.type === 'line',
  )
  return {
    startArrowhead: sharedArrowhead(arrows, 'startArrowhead'),
    endArrowhead: sharedArrowhead(arrows, 'endArrowhead'),
  }
}

function sharedArrowhead(
  arrows: ArrowElement[],
  key: 'startArrowhead' | 'endArrowhead',
): ArrowPanelState['startArrowhead'] {
  if (arrows.length === 0) return 'none'
  const first = arrows[0]![key]
  return arrows.every((arrow) => arrow[key] === first) ? first : '__mixed__'
}

function snapshotKey(
  style: SelectionStyle,
  selection: StylePanelSelection,
  arrow: ArrowPanelState,
): string {
  return JSON.stringify([style, selection, arrow])
}
