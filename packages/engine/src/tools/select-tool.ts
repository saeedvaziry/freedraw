import { createEndpointBinding, rebindEnd, routingForBindings } from '../connectors/lifecycle.js'
import { previewArrow } from '../connectors/preview.js'
import { handleAtScreen, type HandleId, type ResizeHandleId } from '../geometry/handles.js'
import { elementBounds, elementCenter, hitTest, marqueeHits } from '../geometry/hit-test.js'
import type { Rect } from '../geometry/rect.js'
import { snapPointToGrid } from '../geometry/grid.js'
import { snapEndpoint, SNAP_DISTANCE } from '../geometry/snap.js'
import { alignGuides, snapMove, snapResizeBounds, ALIGN_SNAP_DISTANCE, type ResizeEdges } from '../geometry/align-snap.js'
import { resizeElements, resizedBounds, rotationFor } from '../geometry/transform.js'
import { selectionFrameFor } from '../geometry/selection-frame.js'
import { labelRect } from '../geometry/shape-outline.js'
import { moveRouteSegment, routeSegmentAxis, simplifyRoute, snapRouteSegmentTarget } from '../geometry/arrow-geometry.js'
import { planConnectedShape, type SpawnDirection } from '../connectors/spawn.js'
import { createArrow, pointsBounds } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import { labelEditRequest } from '../text/label-edit.js'
import { arrowRoute } from '../connectors/resolve.js'
import { arrowHandleAtScreen, type ArrowHandle } from '../render/overlay/arrow-handles.js'
import { portAtScreen, portHoverAtScreen, shapePortsWorld } from '../render/overlay/ports.js'
import type { ArrowElement, Binding, Element, ElementId, Point, SceneSnapshot } from '../model/types.js'
import type { SceneStore } from '../store/scene-store.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './tool.js'

const MARQUEE_THRESHOLD = 3
const DRAG_THRESHOLD = 4
const PORT_CLICK_RADIUS = 16
const ZERO_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 }
const SPAWN_GHOST_OPACITY = 0.4
const PORT_DIRECTIONS: SpawnDirection[] = ['up', 'right', 'down', 'left']

function portDirection(shape: Element, port: Point): SpawnDirection | null {
  const ports = shapePortsWorld(shape)
  let bestIndex = -1
  let bestDistance = Infinity
  ports.forEach((candidate, index) => {
    const distance = Math.hypot(candidate.x - port.x, candidate.y - port.y)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  return PORT_DIRECTIONS[bestIndex] ?? null
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'move'; start: Point; elements: Element[]; others: Rect[] }
  | { kind: 'marquee'; origin: Point; additive: boolean; base: Set<ElementId> }
  | { kind: 'resize'; handle: ResizeHandleId; elements: Element[]; frame: ReturnType<typeof selectionFrameFor>; others: Rect[] }
  | { kind: 'rotate'; elements: Element[]; center: Point; startAngle: number }
  | {
      kind: 'portPending'
      start: Point
      startBinding: Binding
      sourceId: ElementId
      direction: SpawnDirection | null
      originScreen: Point
    }
  | {
      kind: 'portDrag'
      arrowId: ElementId
      start: Point
      startBinding: Binding
      sourceId: ElementId
      direction: SpawnDirection | null
      originScreen: Point
    }
  | { kind: 'reshapeEndpoint'; arrowId: ElementId; handle: 'start' | 'end' }
  | { kind: 'reshapeSegment'; arrowId: ElementId; segmentIndex: number; route: Point[] }

export class SelectTool implements Tool {
  readonly id = 'select'
  private mode: Mode = { kind: 'idle' }
  private moved = false
  private dragStartScreen: Point | null = null
  private spawnPreviewActive = false

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    this.moved = false
    this.dragStartScreen = info.screen
    if (this.spawnPreviewActive) {
      this.spawnPreviewActive = false
      ctx.setSpawnPreview(null)
    }
    ctx.store.stopCapturing()
    const store = ctx.store
    const selected = store.getUiState().selectedIds
    const selectionElements = selectedElements(store, selected)
    const shapeSelectionElements = selectionElements.filter((element) => !isArrowElement(element))

    const reshape = this.tryReshape(info, ctx, selected)
    if (reshape) return reshape

    const frame = selectionFrameFor(shapeSelectionElements)
    if (frame) {
      const handle = handleAtScreen(info.screen, frame, ctx.camera)
      if (handle) {
        return this.beginHandle(handle, frame, shapeSelectionElements, info.world, otherBounds(store.getSnapshot(), selected))
      }
    }

    const portDrag = this.tryPortDrag(info, ctx)
    if (portDrag) return portDrag

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
    if (nextSelection.has(hit.id)) {
      this.mode = {
        kind: 'move',
        start: snapPointToGrid(info.world),
        elements: selectedElements(store, nextSelection),
        others: otherBounds(store.getSnapshot(), nextSelection),
      }
    }
    return { overlay: true }
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind === 'idle') return this.trackHover(info, ctx)
    if (this.mode.kind === 'portPending') {
      if (screenDistance(info.screen, this.mode.originScreen) <= PORT_CLICK_RADIUS) return { overlay: true }
      this.moved = true
      return this.beginPortDrag(info, ctx, this.mode)
    }
    if (!this.moved) {
      if (!hasDragged(this.dragStartScreen, info.screen)) return { overlay: true }
      this.moved = true
    }
    if (this.mode.kind === 'move') return this.dragMove(info, ctx)
    if (this.mode.kind === 'marquee') return this.dragMarquee(info, ctx)
    if (this.mode.kind === 'resize') return this.dragResize(info, ctx)
    if (this.mode.kind === 'portDrag') return this.dragPort(info, ctx)
    if (this.mode.kind === 'reshapeEndpoint') return this.dragEndpoint(info, ctx)
    if (this.mode.kind === 'reshapeSegment') return this.dragSegment(info, ctx)
    return this.dragRotate(info, ctx)
  }

  onPointerUp(info: PointerInfo, ctx: ToolContext): ToolResult {
    const mode = this.mode
    if (mode.kind === 'portPending') {
      this.spawnFromPort(mode, ctx)
    } else if (mode.kind === 'portDrag') {
      if (!this.moved || screenDistance(info.screen, mode.originScreen) <= PORT_CLICK_RADIUS) {
        this.spawnFromPort(mode, ctx)
      } else if (this.portDragEndedOnSource(info, mode, ctx)) {
        ctx.store.deleteElements([mode.arrowId])
      }
    }
    this.mode = { kind: 'idle' }
    this.dragStartScreen = null
    ctx.setMarquee(null)
    ctx.setGuides([])
    ctx.setPortTarget(null)
    ctx.setSpawnPreview(null)
    ctx.store.stopCapturing()
    return { scene: true, overlay: true }
  }

  private portDragEndedOnSource(
    info: PointerInfo,
    mode: { arrowId: ElementId; sourceId: ElementId },
    ctx: ToolContext,
  ): boolean {
    const hit = hitTest(info.world, ctx.store.getSnapshot())
    return hit?.id === mode.sourceId
  }

  private spawnFromPort(
    mode: { arrowId?: ElementId; sourceId: ElementId; direction: SpawnDirection | null },
    ctx: ToolContext,
  ): void {
    if (mode.arrowId) ctx.store.deleteElements([mode.arrowId])
    if (!mode.direction) return
    ctx.spawnChildAndEdit(mode.sourceId, mode.direction)
  }

  onDoubleClick(info: PointerInfo, ctx: ToolContext): ToolResult | void {
    const hit = hitTest(info.world, ctx.store.getSnapshot())
    if (!hit) return
    ctx.store.setUiState({ selectedIds: new Set([hit.id]) })
    if (isArrowElement(hit)) {
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

  onContextMenu(info: PointerInfo, ctx: ToolContext): ToolResult | void {
    this.spawnPreviewActive = false
    ctx.setSpawnPreview(null)
    const hit = hitTest(info.world, ctx.store.getSnapshot())
    const selected = ctx.store.getUiState().selectedIds
    if (!hit) {
      if (selected.size > 0) ctx.store.setUiState({ selectedIds: new Set() })
    } else if (!selected.has(hit.id)) {
      ctx.store.setUiState({ selectedIds: new Set([hit.id]) })
    }
    const sourceId = hit && !isArrowElement(hit) ? hit.id : null
    ctx.requestContextMenu?.({ screen: info.screen, sourceId })
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
      world: labelRect(element.type, element),
      style: element.style,
      align: label?.align ?? element.style.textAlign,
      verticalAlign: label?.verticalAlign ?? 'middle',
    })
  }

  private beginArrowLabelEdit(arrow: ArrowElement, ctx: ToolContext): void {
    const label = arrow.label
    ctx.beginEdit(labelEditRequest(arrow, label?.text ?? '', { selectAll: true }))
  }

  onKeyDown(event: KeyboardEvent, ctx: ToolContext): ToolResult | void {
    if (!event.altKey) return
    const direction = arrowKeyDirection(event.key)
    if (!direction) return
    const selected = [...ctx.store.getUiState().selectedIds]
    if (selected.length !== 1) return
    const source = ctx.store.getSnapshot().elements[selected[0]!]
    if (!source || isArrowElement(source)) return
    event.preventDefault()
    ctx.spawnChildAndEdit(selected[0]!, direction)
    return { scene: true, overlay: true }
  }

  onDeactivate(ctx: ToolContext): void {
    this.mode = { kind: 'idle' }
    this.dragStartScreen = null
    this.spawnPreviewActive = false
    ctx.setMarquee(null)
    ctx.setGuides([])
    ctx.setPortTarget(null)
    ctx.setSpawnPreview(null)
    ctx.store.setUiState({ hoveredId: null })
  }

  private beginHandle(
    handle: HandleId,
    frame: NonNullable<ReturnType<typeof selectionFrameFor>>,
    elements: Element[],
    pointer: Point,
    others: Rect[],
  ): ToolResult {
    if (handle === 'rotate') {
      const startAngle = Math.atan2(pointer.y - frame.center.y, pointer.x - frame.center.x)
      this.mode = { kind: 'rotate', elements, center: frame.center, startAngle }
      return { overlay: true }
    }
    this.mode = { kind: 'resize', handle, elements, frame, others }
    return { overlay: true }
  }

  private tryReshape(info: PointerInfo, ctx: ToolContext, selected: Set<ElementId>): ToolResult | null {
    const target = this.selectedArrowHandleAt(info, ctx, selected)
    if (!target) return null
    const { element, handle } = target
    if (handle.id === 'midpoint') {
      this.mode = {
        kind: 'reshapeSegment',
        arrowId: element.id,
        segmentIndex: handle.segmentIndex,
        route: arrowRoute(element).map((point) => ({ ...point })),
      }
      return { overlay: true }
    }
    this.mode = { kind: 'reshapeEndpoint', arrowId: element.id, handle: handle.id }
    return { overlay: true }
  }

  private selectedArrowHandleAt(
    info: PointerInfo,
    ctx: ToolContext,
    selected: Set<ElementId>,
  ): { element: ArrowElement; handle: ArrowHandle } | null {
    const snapshot = ctx.store.getSnapshot()
    let best: { element: ArrowElement; handle: ArrowHandle; distance: number } | null = null
    for (const id of selected) {
      const element = snapshot.elements[id]
      if (!element || !isArrowElement(element)) continue
      const handle = arrowHandleAtScreen(info.screen, element, ctx.camera)
      if (!handle) continue
      const distance = Math.hypot(handle.position.x - info.screen.x, handle.position.y - info.screen.y)
      if (!best || distance < best.distance) best = { element, handle, distance }
    }
    return best ? { element: best.element, handle: best.handle } : null
  }

  private tryPortDrag(info: PointerInfo, ctx: ToolContext): ToolResult | null {
    const hit = this.portShapeAt(info, ctx)
    if (!hit) return null
    const { shape, port } = hit

    this.mode = {
      kind: 'portPending',
      start: port,
      startBinding: createEndpointBinding(shape, port, port),
      sourceId: shape.id,
      direction: portDirection(shape, port),
      originScreen: info.screen,
    }
    return { overlay: true }
  }

  private beginPortDrag(
    info: PointerInfo,
    ctx: ToolContext,
    pending: Extract<Mode, { kind: 'portPending' }>,
  ): ToolResult {
    const arrow = createArrow({
      points: [pending.start, pending.start],
      start: pending.startBinding,
      routing: 'orthogonal',
      style: ctx.store.getLastUsedStyle(),
    })
    ctx.store.transact((api) => api.addElement(arrow))
    ctx.store.setUiState({ selectedIds: new Set([arrow.id]) })
    this.mode = {
      kind: 'portDrag',
      arrowId: arrow.id,
      start: pending.start,
      startBinding: pending.startBinding,
      sourceId: pending.sourceId,
      direction: pending.direction,
      originScreen: pending.originScreen,
    }
    return this.dragPort(info, ctx)
  }

  private portShapeAt(info: PointerInfo, ctx: ToolContext): { shape: Element; port: Point } | null {
    return this.visiblePortShapeAt(info, ctx, portAtScreen)
  }

  private portHoverShapeAt(info: PointerInfo, ctx: ToolContext): { shape: Element; port: Point } | null {
    return this.visiblePortShapeAt(info, ctx, portHoverAtScreen)
  }

  private visiblePortShapeAt(
    info: PointerInfo,
    ctx: ToolContext,
    hitPort: (screen: Point, element: Element, camera: ToolContext['camera']) => Point | null,
  ): { shape: Element; port: Point } | null {
    const ui = ctx.store.getUiState()
    const snapshot = ctx.store.getSnapshot()
    const visible = [...ui.selectedIds]
    for (const id of visible) {
      const shape = snapshot.elements[id]
      if (!shape || isArrowElement(shape)) continue
      const port = hitPort(info.screen, shape, ctx.camera)
      if (port) return { shape, port }
    }
    return null
  }

  private dragPort(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'portDrag') return {}
    const arrowId = this.mode.arrowId
    const snapshot = ctx.store.getSnapshot()
    const source = snapshot.elements[this.mode.sourceId]
    const snap = snapEndpoint(info.world, snapshot, {
      threshold: SNAP_DISTANCE / ctx.camera.zoom,
      origin: this.mode.start,
      ignoreId: arrowId,
    })
    const target = snap.target?.id === this.mode.sourceId ? null : snap.target
    ctx.setGuides(snap.guides)
    ctx.setPortTarget(target?.id ?? null)
    const startBinding = source ? createEndpointBinding(source, this.mode.start, snap.point) : this.mode.startBinding
    const endBinding = target ? createEndpointBinding(target, snap.point, this.mode.start) : undefined
    this.writeArrow(ctx, arrowId, [this.mode.start, snap.point], { start: startBinding, end: endBinding })
    return { scene: true, overlay: true }
  }

  private dragEndpoint(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'reshapeEndpoint') return {}
    const arrow = ctx.store.getSnapshot().elements[this.mode.arrowId]
    if (!arrow || !isArrowElement(arrow)) return {}
    const isStart = this.mode.handle === 'start'
    const route = arrowRoute(arrow)
    const fixedEnd = isStart ? route[route.length - 1]! : route[0]!
    const snap = snapEndpoint(info.world, ctx.store.getSnapshot(), {
      threshold: SNAP_DISTANCE / ctx.camera.zoom,
      origin: fixedEnd,
      ignoreId: arrow.id,
    })
    ctx.setGuides(snap.guides)
    ctx.setPortTarget(snap.target?.id ?? null)
    const currentPoints = arrow.points.length >= 2 ? arrow.points : route
    const approach = isStart ? (currentPoints[1] ?? fixedEnd) : (currentPoints[currentPoints.length - 2] ?? fixedEnd)
    const points = isStart
      ? [snap.point, ...currentPoints.slice(1)]
      : [...currentPoints.slice(0, -1), snap.point]
    const binding = rebindEnd(arrow, this.mode.handle, snap, approach)
    this.writeArrow(ctx, arrow.id, points, isStart ? { start: binding } : { end: binding })
    return { scene: true, overlay: true }
  }

  private dragSegment(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'reshapeSegment') return {}
    const arrow = ctx.store.getSnapshot().elements[this.mode.arrowId]
    if (!arrow || !isArrowElement(arrow)) return {}
    const target = snapRouteSegmentTarget(this.mode.route, this.mode.segmentIndex, info.world)
    let points = moveRouteSegment(this.mode.route, this.mode.segmentIndex, target)
    const bindings = this.slideEndpointBindings(arrow, this.mode.route, points, this.mode.segmentIndex, ctx.store.getSnapshot())
    if ('start' in bindings || 'end' in bindings) points = simplifyRoute(points)
    this.writeArrow(ctx, arrow.id, points, bindings)
    return { scene: true, overlay: true }
  }

  private slideEndpointBindings(arrow: ArrowElement, originalRoute: Point[], points: Point[], segmentIndex: number, snapshot: SceneSnapshot): { start?: Binding | null; end?: Binding | null } {
    if (originalRoute.length <= 2) return {}
    const start = originalRoute[segmentIndex]
    const end = originalRoute[segmentIndex + 1]
    if (!start || !end) return {}
    const axis = routeSegmentAxis(start, end)
    if (!axis) return {}

    const bindings: { start?: Binding | null; end?: Binding | null } = {}
    if (segmentIndex === 0 && arrow.start) {
      const target = snapshot.elements[arrow.start.elementId]
      const next = points[1]
      if (target && !isArrowElement(target) && next) {
        const point = endpointOnMovedSegment(points[0]!, next, axis)
        points[0] = point
        bindings.start = createEndpointBinding(target, point, next)
      }
    }
    if (segmentIndex === originalRoute.length - 2 && arrow.end) {
      const target = snapshot.elements[arrow.end.elementId]
      const previous = points[points.length - 2]
      if (target && !isArrowElement(target) && previous) {
        const index = points.length - 1
        const point = endpointOnMovedSegment(points[index]!, previous, axis)
        points[index] = point
        bindings.end = createEndpointBinding(target, point, previous)
      }
    }
    return bindings
  }

  private writeArrow(
    ctx: ToolContext,
    id: ElementId,
    points: Point[],
    bindings: { start?: Binding | null; end?: Binding | null },
  ): void {
    const arrow = ctx.store.getSnapshot().elements[id]
    if (!arrow || !isArrowElement(arrow)) return
    const nextPoints = points.map((point) => ({ ...point }))
    const patch: Partial<ArrowElement> = {
      points: nextPoints,
      routing: routingForBindings(arrow, bindings),
    }
    if ('start' in bindings) patch.start = bindings.start ?? undefined
    if ('end' in bindings) patch.end = bindings.end ?? undefined
    ctx.store.transact((api) => api.updateElement(id, patch))
  }

  private trackHover(info: PointerInfo, ctx: ToolContext): ToolResult {
    const snapshot = ctx.store.getSnapshot()
    const portHit = this.portShapeAt(info, ctx)
    const spawned = this.trackSpawnPreview(info, ctx, portHit)
    const hit = hitTest(info.world, snapshot)
    const portHover = portHit ?? (hit ? null : this.portHoverShapeAt(info, ctx))
    const nextId = portHover?.shape.id ?? hit?.id ?? null
    if (nextId === ctx.store.getHoveredId()) return spawned ? { overlay: true } : {}
    ctx.store.setHoveredId(nextId)
    return { overlay: true }
  }

  private trackSpawnPreview(
    info: PointerInfo,
    ctx: ToolContext,
    hit: { shape: Element; port: Point } | null,
  ): boolean {
    const direction = hit ? portDirection(hit.shape, hit.port) : null
    if (!hit || !direction) {
      const had = this.spawnPreviewActive
      this.spawnPreviewActive = false
      if (had) ctx.setSpawnPreview(null)
      return had
    }
    const obstacles = otherBounds(ctx.store.getSnapshot(), new Set([hit.shape.id]))
    const { target, arrow } = planConnectedShape(hit.shape, direction, ctx.store.getLastUsedStyle(), undefined, obstacles)
    const preview = previewArrow(arrow, ctx.store.getSnapshot(), { [hit.shape.id]: hit.shape, [target.id]: target })
    ctx.setSpawnPreview({
      target: { ...target, style: { ...target.style, opacity: target.style.opacity * SPAWN_GHOST_OPACITY } },
      arrow: { ...preview, style: { ...preview.style, opacity: preview.style.opacity * SPAWN_GHOST_OPACITY } },
    })
    this.spawnPreviewActive = true
    return true
  }

  private dragMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (this.mode.kind !== 'move') return {}
    const next = snapPointToGrid(info.world)
    const gridDx = next.x - this.mode.start.x
    const gridDy = next.y - this.mode.start.y
    const elements = this.mode.elements
    const { dx, dy } = this.applyAlignMove(ctx, elements, gridDx, gridDy, this.mode.others)
    const movingShapeIds = new Set(elements.filter((element) => !isArrowElement(element)).map((element) => element.id))
    ctx.store.transact((api) => {
      for (const element of elements) {
        if (!ctx.store.getSnapshot().elements[element.id]) continue
        if (isArrowElement(element)) {
          const translate = (point: Point) => ({ x: point.x + dx, y: point.y + dy })
          const detachStart = element.start && !movingShapeIds.has(element.start.elementId)
          const detachEnd = element.end && !movingShapeIds.has(element.end.elementId)
          const points = detachStart || detachEnd ? arrowRoute(element).map(translate) : element.points.map(translate)
          api.updateElement(element.id, {
            points,
            ...(detachStart ? { start: undefined } : {}),
            ...(detachEnd ? { end: undefined } : {}),
            routing: detachStart && detachEnd ? 'straight' : element.routing,
          })
          continue
        }
        if (element.type === 'freedraw') {
          const points = element.points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
          api.updateElement(element.id, { points, ...pointsBounds(points) })
          continue
        }
        api.updateElement(element.id, { x: element.x + dx, y: element.y + dy })
      }
    })
    return { scene: true, overlay: true }
  }

  private applyAlignMove(
    ctx: ToolContext,
    elements: Element[],
    gridDx: number,
    gridDy: number,
    others: Rect[],
  ): { dx: number; dy: number } {
    const fallback = { dx: gridDx, dy: gridDy }
    if (others.length === 0) {
      ctx.setGuides([])
      return fallback
    }
    const frame = selectionFrameFor(elements)
    if (!frame || frame.rotation) {
      ctx.setGuides([])
      return fallback
    }
    const moved: Rect = { ...frame.bounds, x: frame.bounds.x + gridDx, y: frame.bounds.y + gridDy }
    const snap = snapMove(moved, others, ALIGN_SNAP_DISTANCE / ctx.camera.zoom)
    ctx.setGuides(alignGuides(snap.lines, snap.distances))
    return { dx: gridDx + snap.dx, dy: gridDy + snap.dy }
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
    const grid = resizedBounds(this.mode.frame, this.mode.handle, snapPointToGrid(info.world))
    const next = this.alignResizeBounds(ctx, grid, this.mode.handle, this.mode.frame.rotation, this.mode.others)
    const patches = resizeElements(this.mode.elements, this.mode.frame, next)
    ctx.store.transact((api) => patches.forEach(({ id, patch }) => api.updateElement(id, patch)))
    return { scene: true, overlay: true }
  }

  private alignResizeBounds(
    ctx: ToolContext,
    grid: Rect,
    handle: ResizeHandleId,
    rotation: number,
    others: Rect[],
  ): Rect {
    if (rotation || others.length === 0) {
      ctx.setGuides([])
      return grid
    }
    const snap = snapResizeBounds(grid, resizeEdgesFor(handle), others, ALIGN_SNAP_DISTANCE / ctx.camera.zoom)
    ctx.setGuides(alignGuides(snap.lines))
    return snap.bounds
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

function endpointOnMovedSegment(endpoint: Point, segmentPoint: Point, axis: 'horizontal' | 'vertical'): Point {
  if (axis === 'horizontal') return { x: endpoint.x, y: segmentPoint.y }
  return { x: segmentPoint.x, y: endpoint.y }
}

function otherBounds(snapshot: SceneSnapshot, exclude: Set<ElementId>): Rect[] {
  const bounds: Rect[] = []
  for (const id of snapshot.order) {
    if (exclude.has(id)) continue
    const element = snapshot.elements[id]
    if (!element || isArrowElement(element)) continue
    bounds.push(elementBounds(element))
  }
  return bounds
}

function resizeEdgesFor(handle: ResizeHandleId): ResizeEdges {
  return {
    left: handle.includes('w'),
    right: handle.includes('e'),
    top: handle.includes('n'),
    bottom: handle.includes('s'),
  }
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

function hasDragged(start: Point | null, current: Point): boolean {
  return !start || screenDistance(start, current) > DRAG_THRESHOLD
}

function screenDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
