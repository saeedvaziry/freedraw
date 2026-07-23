import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'
import {
  MIXED,
  hitTest,
  selectionBounds,
  shallowEqual,
  type EditorController,
  type Element,
  type ElementId,
  type SceneStore,
} from '@freedraw/engine'
import type { BoardActionContext } from '../board-actions.js'
import { useBoardContext } from '../board-context.js'
import { SelectionToolbar } from './selection-toolbar.js'

const GAP = 12
const MARGIN = 8

interface ToolbarState {
  count: number
  stroke: string | null
  editableId: ElementId | null
  grouped: boolean
}

interface Anchor {
  centerX: number
  top: number
  bottom: number
}

export function SelectionToolbarHost() {
  const board = useBoardContext()
  const { store, controller, readOnly } = board

  const view = useMemo(
    () => store.select(readToolbarState, { equals: shallowEqual, channels: ['doc', 'selection'] }),
    [store],
  )
  const state = useSyncExternalStore(view.subscribe, view.getSnapshot)
  const editing = useTextEditing(controller)
  const dragging = useEmptyCanvasDrag(store, controller)

  const containerRef = useRef<HTMLDivElement>(null)
  const visible = !readOnly && controller != null && state.count > 0 && !editing && !dragging
  usePositionSync(containerRef, store, controller, visible)

  if (!visible || !controller) return null

  const anchor = selectionAnchor(store, controller)
  const selectedIds = () => store.getUiState().selectedIds
  const actionContext: BoardActionContext = {
    store,
    controller,
    boardExport: board.boardExport,
    theme: board.theme,
    openImagePicker: () => {},
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute top-0 left-0 z-30"
      style={
        anchor
          ? { left: anchor.centerX, top: anchor.top - GAP, transform: 'translate(-50%, -100%)' }
          : { visibility: 'hidden' }
      }
    >
      <SelectionToolbar
        stroke={state.stroke}
        canEdit={state.editableId != null}
        actionContext={actionContext}
        onPickColor={(color) => store.updateStyle(selectedIds(), { stroke: color })}
        onEdit={() => editSelection(store, controller)}
        onDuplicate={() => store.duplicateElements(selectedIds())}
        onDelete={() => store.deleteElements(selectedIds())}
        onCopy={() => store.copyElements(selectedIds())}
        onCut={() => store.cutElements(selectedIds())}
      />
    </div>
  )
}

function readToolbarState(store: SceneStore): ToolbarState {
  const ids = [...store.getUiState().selectedIds]
  const count = ids.length
  const style = store.getSelectionStyle()
  const stroke = style.stroke === MIXED ? null : style.stroke
  const elements = store.getSnapshot().elements
  let editableId: ElementId | null = null
  if (count === 1) {
    const element = elements[ids[0]!]
    if (element && element.type !== 'freedraw' && element.type !== 'image') editableId = element.id
  }
  const grouped = ids.some((id) => elements[id]?.groupId != null)
  return { count, stroke, editableId, grouped }
}

function selectedElements(store: SceneStore): Element[] {
  const snapshot = store.getSnapshot()
  return [...store.getUiState().selectedIds]
    .map((id) => snapshot.elements[id])
    .filter((element): element is Element => Boolean(element))
}

function selectionAnchor(store: SceneStore, controller: EditorController): Anchor | null {
  const bounds = selectionBounds(selectedElements(store))
  if (!bounds) return null
  const topLeft = controller.worldToScreen({ x: bounds.x, y: bounds.y })
  const topRight = controller.worldToScreen({ x: bounds.x + bounds.width, y: bounds.y })
  const bottomLeft = controller.worldToScreen({ x: bounds.x, y: bounds.y + bounds.height })
  return {
    centerX: (topLeft.x + topRight.x) / 2,
    top: topLeft.y,
    bottom: bottomLeft.y,
  }
}

function editSelection(store: SceneStore, controller: EditorController): void {
  const ids = [...store.getUiState().selectedIds]
  if (ids.length !== 1) return
  const element = store.getSnapshot().elements[ids[0]!]
  if (!element || element.type === 'freedraw' || element.type === 'image') return
  const text = element.type === 'text' ? element.text : (element.label?.text ?? '')
  controller.beginLabelEditFromText(element.id, text)
}

function usePositionSync(
  ref: RefObject<HTMLDivElement | null>,
  store: SceneStore,
  controller: EditorController | null,
  active: boolean,
): void {
  useEffect(() => {
    if (!active || !controller) return
    let raf = 0
    let last = ''
    const tick = (): void => {
      const el = ref.current
      if (el) {
        const anchor = selectionAnchor(store, controller)
        if (anchor) {
          const width = el.offsetWidth
          const height = el.offsetHeight
          const viewportWidth = controller.viewportSize.width
          const half = width / 2
          const left = clamp(anchor.centerX, half + MARGIN, viewportWidth - half - MARGIN)
          const below = anchor.top - GAP - height < MARGIN
          const top = below ? anchor.bottom + GAP : anchor.top - GAP
          const transform = below ? 'translateX(-50%)' : 'translate(-50%, -100%)'
          const next = `${left}|${top}|${transform}`
          if (next !== last) {
            last = next
            el.style.left = `${left}px`
            el.style.top = `${top}px`
            el.style.transform = transform
          }
          el.style.visibility = 'visible'
        } else {
          el.style.visibility = 'hidden'
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ref, store, controller, active])
}

function useTextEditing(controller: EditorController | null): boolean {
  const [editing, setEditing] = useState<boolean>(() => controller?.activeEdit != null)
  useEffect(() => {
    if (!controller) {
      setEditing(false)
      return
    }
    setEditing(controller.activeEdit != null)
    return controller.subscribeEdit((request) => setEditing(request != null))
  }, [controller])
  return editing
}

function useEmptyCanvasDrag(store: SceneStore, controller: EditorController | null): boolean {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    if (!controller) return
    const onDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof HTMLCanvasElement)) return
      const rect = target.getBoundingClientRect()
      const world = controller.screenToWorld({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
      if (hitTest(world, store.getSnapshot())) return
      setDragging(true)
      const clear = (): void => setDragging(false)
      window.addEventListener('pointerup', clear, { once: true })
      window.addEventListener('pointercancel', clear, { once: true })
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [store, controller])
  return dragging
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2
  return Math.min(Math.max(value, min), max)
}
