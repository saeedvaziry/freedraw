import { PanelRightClose, SlidersHorizontal } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ArrowElement, Element, SceneStore } from '@freedraw/engine'
import { useBoardContext } from './board-context.js'
import {
  FloatingPanel,
  IconButton,
  StylePanel,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ArrowPanelPatch,
  type ArrowPanelState,
  type PanelStyle,
  type PanelStylePatch,
  type StylePanelSelection,
} from '@/components/board/ui-kit'
import { normalizeHex } from './style-panel/color.js'
import {
  readRecentColors,
  rememberColor,
  writeRecentColors,
} from './style-panel/recent-colors.js'
import { COLOR_PATCH_KEYS, type PanelPalette } from './style-panel/types.js'

interface StylePanelHostProps {
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
  documentColors: string[]
}

export const MAX_DOCUMENT_COLORS = 12

const FILL_LESS = new Set(['arrow', 'line', 'text'])
const DEFAULT_SELECTION: StylePanelSelection = {
  hasShape: true,
  hasFill: true,
  hasRoundness: true,
  hasText: true,
  hasArrow: false,
}

export function StylePanelHost({ collapsible = false }: StylePanelHostProps) {
  const { store, readOnly } = useBoardContext()
  const panel = useMemo(
    () => store.select(readSnapshot, { equals: panelEquals, channels: ['doc', 'selection'] }),
    [store],
  )
  const snapshot = useSyncExternalStore(panel.subscribe, panel.getSnapshot)

  // Collapsed-to-icon state, persisted like the left sidebar and read
  // synchronously on mount so it never flickers open on reload.
  const [collapsed, setCollapsed] = useState<boolean>(() => collapsible && readCollapsed())
  useLayoutEffect(() => {
    if (collapsible) window.localStorage.setItem(COLLAPSE_KEY, collapsed ? 'collapsed' : 'expanded')
  }, [collapsible, collapsed])

  const collapse = useCallback(() => setCollapsed(true), [])
  const expand = useCallback(() => setCollapsed(false), [])

  const [recent, setRecent] = useState<string[]>(readRecentColors)
  const remember = useCallback((value: string) => {
    setRecent((current) => {
      const next = rememberColor(current, value)
      if (next.length === current.length && next.every((color, i) => color === current[i])) {
        return current
      }
      writeRecentColors(next)
      return next
    })
  }, [])

  const palette = useMemo<PanelPalette>(
    () => ({ recent, document: snapshot.documentColors }),
    [recent, snapshot.documentColors],
  )

  if (readOnly) return null

  const updateStyle = (patch: PanelStylePatch): void => {
    for (const key of COLOR_PATCH_KEYS) {
      const value = patch[key]
      if (typeof value === 'string') remember(value)
    }
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
      <FloatingPanel className="pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              onClick={expand}
              aria-label="Show style panel"
              className="text-foreground/70 [&_svg]:size-5"
            >
              <SlidersHorizontal />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent side="left">Style</TooltipContent>
        </Tooltip>
      </FloatingPanel>
    )
  }

  return (
    <StylePanel
      selection={snapshot.selection}
      style={snapshot.style}
      arrow={snapshot.arrow}
      palette={palette}
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
      <IconButton
        onClick={onCollapse}
        aria-label="Collapse style panel"
        title="Collapse style panel"
        className="size-7 rounded-md text-foreground/70 coarse:size-7"
      >
        <PanelRightClose />
      </IconButton>
    </div>
  )
}

function readSnapshot(store: SceneStore): PanelSnapshot {
  const ui = store.getUiState()
  const selectionStyle = store.getSelectionStyle()
  const selected = [...ui.selectedIds]
    .map((id) => store.getSnapshot().elements[id])
    .filter((element): element is Element => Boolean(element))

  const selection = selected.length === 0 ? DEFAULT_SELECTION : deriveSelection(selected)
  const arrow = deriveArrow(selected)

  return {
    selection,
    style: selectionStyle as PanelStyle,
    arrow,
    documentColors: documentColors(store),
  }
}

export function documentColors(store: SceneStore): string[] {
  const snapshot = store.getSnapshot()
  const colors: string[] = []
  const push = (value: string | undefined): void => {
    if (colors.length >= MAX_DOCUMENT_COLORS) return
    if (!value) return
    const hex = normalizeHex(value)
    if (!hex || colors.includes(hex)) return
    colors.push(hex)
  }
  for (const id of snapshot.order) {
    const element = snapshot.elements[id]
    if (!element) continue
    push(element.style.stroke)
    push(element.style.fill)
    push(element.style.textColor)
    if (colors.length >= MAX_DOCUMENT_COLORS) break
  }
  return colors
}

function panelEquals(a: PanelSnapshot, b: PanelSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
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
