import { createBinding } from '../connectors/binding.js'
import { handleAtScreen, type HandleId, type ResizeHandleId } from '../geometry/handles.js'
import { elementCenter, hitTest, marqueeHits } from '../geometry/hitTest.js'
import type { Rect } from '../geometry/rect.js'
import { snapEndpoint, SNAP_DISTANCE } from '../geometry/snap.js'
import { resizeElements, resizedBounds, rotationFor } from '../geometry/transform.js'
import { selectionFrameFor } from '../geometry/selectionFrame.js'
import { spawnConnectedShape } from '../connectors/spawn.js'
import { createArrow, pointsBounds } from '../model/factory.js'
import { polylineMidpoint } from '../text/arrowLabel.js'
import { arrowHandleAtScreen, type ArrowHandleId } from '../render/overlay/arrowHandles.js'
import { portAtScreen } from '../render/overlay/ports.js'
import type { ArrowElement, Binding, Element, ElementId, Point } from '../model/types.js'
import type { SceneStore } from '../store/SceneStore.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './Tool.js'

const MARQUEE_THRESHOLD = 3
const ZERO_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 }

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'move'; last: Point }
  | { kind: 'marquee'; origin: Point; additive: boolean; base: Set<ElementId> }
  | { kind: 'resize'; handle: ResizeHandleId; elements: Element[]; frame: ReturnType<typeof selectionFrameFor> }
  | { kind: 'rotate'; elements: Element[]; center: Point; startAngle: number }
  | { kind: 'portDrag'; arrowId: ElementId; start: Point; startBinding: Binding }
  | { kind: 'reshape'; arrowId: ElementId; handle: ArrowHandleId; index: number; midInserted: boolean }

export class SelectTool implements Tool {
  readonly id = 'select'
  private mode: Mode = { kind: 'idle' }
  private moved = false

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    this.moved = false
    ctx.store.stopCapturing()
    const store = ctx.store
    const selected = store.getUiState().selectedIds

    const reshape = this.tryReshape(info, ctx, selected)
    if (reshape) return reshape

    const portDrag = this.tryPortDrag(info, ctx)
    if (portDrag) return portDrag

    const frame = selectionFrameFor(selectedElements(store, selected))
    if (frame) {
      const handle = handleAtScreen(info.screen, frame, ctx.camera)
      if (handle) return this.beginHandle(handle, frame, selectedElements(store, selected), info.world)
    }

    const hit = hitTest(info.world, store.getSnapshot())
    if (!hit) {
      this.mode = {
        kind: 'marquee',
        origin: info.world,
        additive: info.shiftKey,
        base: new Set(selected),
      }
      if (!info.shiftKey && selected.size > 0) store.setUiState({ selectedIds: new Set() })
      return { overlay: true }
    }

    const nextSelection = this.resolveSelection(selected, hit.id, info.shiftKey)
    store.setUiState({ selectedIds: nextSelection })
    if (nextSelection.has(hit.id)) this.mode = { kind: 'move', last: info.world }
    return { overlay: true }
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind === 'idle') return this.trackHover(info, ctx)
    this.moved = true
    if (this.mode.kind === 'move') return this.dragMove(info, ctx)
    if (this.mode.kind === 'marquee') return this.dragMarquee(info, ctx)
    if (this.mode.kind === 'resize') return this.dragResize(info, ctx)
    if (this.mode.kind === 'portDrag') return this.dragPort(info, ctx)
    if (this.mode.kind === 'reshape') return this.dragReshape(info, ctx)
    return this.dragRotate(info, ctx)
  }

  onPointerUp(_info: PointerInfo, ctx: ToolContext): ToolResult {
    const mode = this.mode
    if (mode.kind === 'portDrag' && !this.moved) {
      ctx.store.deleteElements([mode.arrowId])
    }
    this.mode = { kind: 'idle' }
    ctx.setMarquee(null)
    ctx.setGuides([])
    ctx.setPortTarget(null)
    ctx.store.stopCapturing()
    return { scene: true, overlay: true }
  }

  onDoubleClick(info: PointerInfo, ctx: ToolContext): ToolResult | void {
    const hit = hitTest(info.world, ctx.store.getSnapshot())
    if (!hit) return
    ctx.store.setUiState({ selectedIds: new Set([hit.id]) })
    if (isArrow(hit)) {
      this.beginArrowLabelEdit(hit, ctx)
      return { overlay: true }
    }
    if (hit.type === 'text') {
      this.beginTextEdit(hit, ctx)
      return { overlay: true }
    }
    this.beginLabelEdit(hit, ctx)
    return { overlay: true }
  }

  private beginTextEdit(element: Element, ctx: ToolContext): void {
    if (element.type !== 'text') return
    ctx.beginEdit({
      elementId: element.id,
      target: 'text',
      text: element.text,
      world: { x: element.x, y: element.y, width: element.width, height: element.height },
      style: element.style,
      align: element.style.textAlign,
      verticalAlign: 'top',
    })
  }

  private beginLabelEdit(element: Element, ctx: ToolContext): void {
    const label = element.label
    ctx.beginEdit({
      elementId: element.id,
      target: 'label',
      text: label?.text ?? '',
      world: { x: element.x, y: element.y, width: element.width, height: element.height },
      style: element.style,
      align: label?.align ?? 'center',
      verticalAlign: label?.verticalAlign ?? 'middle',
    })
  }

  private beginArrowLabelEdit(arrow: ArrowElement, ctx: ToolContext): void {
    const mid = polylineMidpoint(arrow.points)
    const label = arrow.label
    ctx.beginEdit({
      elementId: arrow.id,
      target: 'label',
      text: label?.text ?? '',
      world: { x: mid.x, y: mid.y, width: 0, height: arrow.style.fontSize },
      style: arrow.style,
      align: 'center',
      verticalAlign: 'middle',
    })
  }

  onKeyDown(event: KeyboardEvent, ctx: ToolContext): ToolResult | void {
    if (!event.altKey) return
    const direction = arrowKeyDirection(event.key)
    if (!direction) return
    const selected = [...ctx.store.getUiState().selectedIds]
    if (selected.length !== 1) return
    const source = ctx.store.getSnapshot().elements[selected[0]!]
    if (!source || isArrow(source)) return
    event.preventDefault()
    spawnConnectedShape(ctx.store, source, direction)
    return { scene: true, overlay: true }
  }

  onDeactivate(ctx: ToolContext): void {
    this.mode = { kind: 'idle' }
    ctx.setMarquee(null)
    ctx.setGuides([])
    ctx.setPortTarget(null)
    ctx.store.setUiState({ hoveredId: null })
  }

  private beginHandle(
    handle: HandleId,
    frame: NonNullable<ReturnType<typeof selectionFrameFor>>,
    elements: Element[],
    pointer: Point,
  ): ToolResult {
    if (handle === 'rotate') {
      const startAngle = Math.atan2(pointer.y - frame.center.y, pointer.x - frame.center.x)
      this.mode = { kind: 'rotate', elements, center: frame.center, startAngle }
      return { overlay: true }
    }
    this.mode = { kind: 'resize', handle, elements, frame }
    return { overlay: true }
  }

  private tryReshape(info: PointerInfo, ctx: ToolContext, selected: Set<ElementId>): ToolResult | null {
    if (selected.size !== 1) return null
    const element = ctx.store.getSnapshot().elements[[...selected][0]!]
    if (!element || !isArrow(element)) return null
    const handle = arrowHandleAtScreen(info.screen, element, ctx.camera)
    if (!handle) return null
    if (handle.id === 'midpoint') {
      this.mode = { kind: 'reshape', arrowId: element.id, handle: 'midpoint', index: handle.index, midInserted: false }
      return { overlay: true }
    }
    this.mode = { kind: 'reshape', arrowId: element.id, handle: handle.id, index: handle.index, midInserted: false }
    return { overlay: true }
  }

  private tryPortDrag(info: PointerInfo, ctx: ToolContext): ToolResult | null {
    const ui = ctx.store.getUiState()
    const candidateId = ui.hoveredId ?? [...ui.selectedIds][0]
    if (!candidateId) return null
    const shape = ctx.store.getSnapshot().elements[candidateId]
    if (!shape || isArrow(shape)) return null
    const port = portAtScreen(info.screen, shape, ctx.camera)
    if (!port) return null

    const arrow = createArrow({ points: [port, port], start: createBinding(shape, port) })
    ctx.store.transact((api) => api.addElement(arrow))
    ctx.store.setUiState({ selectedIds: new Set([arrow.id]) })
    this.mode = { kind: 'portDrag', arrowId: arrow.id, start: port, startBinding: arrow.start! }
    return { overlay: true }
  }

  private dragPort(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'portDrag') return {}
    const arrowId = this.mode.arrowId
    const snap = snapEndpoint(info.world, ctx.store.getSnapshot(), {
      threshold: SNAP_DISTANCE / ctx.camera.zoom,
      origin: this.mode.start,
      ignoreId: arrowId,
    })
    ctx.setGuides(snap.guides)
    ctx.setPortTarget(snap.target?.id ?? null)
    const endBinding = snap.target ? createBinding(snap.target, snap.point) : undefined
    this.writeArrow(ctx, arrowId, [this.mode.start, snap.point], { end: endBinding })
    return { scene: true, overlay: true }
  }

  private dragReshape(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'reshape') return {}
    const arrow = ctx.store.getSnapshot().elements[this.mode.arrowId]
    if (!arrow || !isArrow(arrow)) return {}

    if (this.mode.handle === 'midpoint') return this.dragMidpoint(info, ctx, arrow)
    return this.dragEndpoint(info, ctx, arrow)
  }

  private dragEndpoint(info: PointerInfo, ctx: ToolContext, arrow: ArrowElement): ToolResult {
    if (this.mode.kind !== 'reshape') return {}
    const isStart = this.mode.handle === 'start'
    const fixedEnd = isStart ? arrow.points[arrow.points.length - 1]! : arrow.points[0]!
    const snap = snapEndpoint(info.world, ctx.store.getSnapshot(), {
      threshold: SNAP_DISTANCE / ctx.camera.zoom,
      origin: fixedEnd,
      ignoreId: arrow.id,
    })
    ctx.setGuides(snap.guides)
    ctx.setPortTarget(snap.target?.id ?? null)
    const points = isStart ? [snap.point, fixedEnd] : [fixedEnd, snap.point]
    const binding = snap.target ? createBinding(snap.target, snap.point) : null
    this.writeArrow(ctx, arrow.id, points, isStart ? { start: binding } : { end: binding })
    return { scene: true, overlay: true }
  }

  private dragMidpoint(info: PointerInfo, ctx: ToolContext, arrow: ArrowElement): ToolResult {
    if (this.mode.kind !== 'reshape') return {}
    const points = arrow.points.map((point) => ({ ...point }))
    if (!this.mode.midInserted) {
      points.splice(this.mode.index + 1, 0, info.world)
      this.mode = { ...this.mode, index: this.mode.index + 1, midInserted: true }
    } else {
      points[this.mode.index] = info.world
    }
    this.writeArrow(ctx, arrow.id, points, {})
    return { scene: true, overlay: true }
  }

  private writeArrow(
    ctx: ToolContext,
    id: ElementId,
    points: Point[],
    bindings: { start?: Binding | null; end?: Binding | null },
  ): void {
    const patch: Partial<ArrowElement> = { points, ...pointsBounds(points) }
    if ('start' in bindings) patch.start = bindings.start ?? undefined
    if ('end' in bindings) patch.end = bindings.end ?? undefined
    ctx.store.transact((api) => api.updateElement(id, patch))
  }

  private trackHover(info: PointerInfo, ctx: ToolContext): ToolResult {
    const hit = hitTest(info.world, ctx.store.getSnapshot())
    const nextId = hit?.id ?? null
    if (nextId === ctx.store.getUiState().hoveredId) return {}
    ctx.store.setUiState({ hoveredId: nextId })
    return { overlay: true }
  }

  private dragMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'move') return {}
    const dx = info.world.x - this.mode.last.x
    const dy = info.world.y - this.mode.last.y
    this.mode.last = info.world
    const ids = ctx.store.getUiState().selectedIds
    ctx.store.transact((api) => {
      for (const id of ids) {
        const element = ctx.store.getSnapshot().elements[id]
        if (!element) continue
        api.updateElement(id, { x: element.x + dx, y: element.y + dy })
      }
    })
    return { scene: true, overlay: true }
  }

  private dragMarquee(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'marquee') return {}
    const rect = boundsBetween(this.mode.origin, info.world)
    ctx.setMarquee(rect)
    if (rect.width < MARQUEE_THRESHOLD && rect.height < MARQUEE_THRESHOLD) return { overlay: true }
    const hits = marqueeHits(rect, ctx.store.getSnapshot())
    const selected = new Set(this.mode.additive ? this.mode.base : [])
    hits.forEach((element) => selected.add(element.id))
    ctx.store.setUiState({ selectedIds: selected })
    return { overlay: true }
  }

  private dragResize(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'resize' || !this.mode.frame) return {}
    const next = resizedBounds(this.mode.frame, this.mode.handle, info.world)
    const patches = resizeElements(this.mode.elements, this.mode.frame, next)
    ctx.store.transact((api) => patches.forEach(({ id, patch }) => api.updateElement(id, patch)))
    return { scene: true, overlay: true }
  }

  private dragRotate(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'rotate') return {}
    if (this.mode.elements.length === 1) {
      const element = this.mode.elements[0]
      const rotation = rotationFor({ center: this.mode.center, bounds: ZERO_RECT, rotation: 0 }, info.world)
      if (element) ctx.store.transact((api) => api.updateElement(element.id, { rotation }))
      return { scene: true, overlay: true }
    }
    const delta = Math.atan2(info.world.y - this.mode.center.y, info.world.x - this.mode.center.x) - this.mode.startAngle
    this.rotateGroup(delta, ctx)
    return { scene: true, overlay: true }
  }

  private rotateGroup(delta: number, ctx: ToolContext): void {
    if (this.mode.kind !== 'rotate') return
    const { center, elements } = this.mode
    const cos = Math.cos(delta)
    const sin = Math.sin(delta)
    ctx.store.transact((api) => {
      for (const element of elements) {
        const ec = elementCenter(element)
        const dx = ec.x - center.x
        const dy = ec.y - center.y
        const nx = center.x + dx * cos - dy * sin
        const ny = center.y + dx * sin + dy * cos
        api.updateElement(element.id, {
          x: nx - element.width / 2,
          y: ny - element.height / 2,
          rotation: element.rotation + delta,
        })
      }
    })
  }

  private resolveSelection(current: Set<ElementId>, id: ElementId, shift: boolean): Set<ElementId> {
    if (!shift) {
      if (current.has(id) && current.size > 1) return new Set(current)
      return new Set([id])
    }
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
}

function selectedElements(store: SceneStore, ids: Set<ElementId>): Element[] {
  const snapshot = store.getSnapshot()
  return [...ids].map((id) => snapshot.elements[id]).filter(Boolean) as Element[]
}

function boundsBetween(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

function arrowKeyDirection(key: string): 'left' | 'right' | 'up' | 'down' | null {
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  if (key === 'ArrowUp') return 'up'
  if (key === 'ArrowDown') return 'down'
  return null
}
