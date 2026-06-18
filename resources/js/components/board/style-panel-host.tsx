import { useSyncExternalStore } from 'react'
import type { ArrowElement, Element, SceneStore, SelectionStyle } from '@freedraw/engine'
import {
  StylePanel,
  type ArrowPanelPatch,
  type ArrowPanelState,
  type PanelStyle,
  type PanelStylePatch,
  type StylePanelSelection,
} from '@/components/board/ui-kit'

interface StylePanelHostProps {
  store: SceneStore
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

export function StylePanelHost({ store }: StylePanelHostProps) {
  const snapshot = useSyncExternalStore(
    (cb) => store.subscribeStyle(cb),
    () => readSnapshot(store),
  )

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

  return (
    <StylePanel
      selection={snapshot.selection}
      style={snapshot.style}
      arrow={snapshot.arrow}
      onStyleChange={updateStyle}
      onArrowChange={updateArrow}
      onInteractStart={() => store.stopCapturing()}
      onInteractEnd={() => store.stopCapturing()}
    />
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
