import { createBinding } from '../connectors/binding.js'
import { resolveArrowPoints } from '../connectors/resolve.js'
import { GRID_SIZE } from '../geometry/grid.js'
import { snapEndpoint, SNAP_DISTANCE } from '../geometry/snap.js'
import { createArrow, pointsBounds } from '../model/factory.js'
import type { ArrowElement, Binding, Element, Point } from '../model/types.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from './tool.js'

const MIN_LENGTH = GRID_SIZE

export class ArrowTool implements Tool {
  readonly id: 'arrow' | 'line'
  private start: Point | null = null
  private startTarget: Element | null = null

  constructor(kind: 'arrow' | 'line' = 'arrow') {
    this.id = kind
  }

  onPointerDown(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (info.button !== 0) return {}
    const snap = snapEndpoint(info.world, ctx.store.getSnapshot(), { threshold: worldThreshold(ctx) })
    this.start = snap.point
    this.startTarget = snap.target
    return {}
  }

  onPointerMove(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.start) return {}
    const snap = snapEndpoint(info.world, ctx.store.getSnapshot(), {
      threshold: worldThreshold(ctx),
      origin: this.start,
    })
    ctx.setGuides(snap.guides)
    ctx.setPortTarget(snap.target?.id ?? null)
    ctx.setPreview(this.build(ctx, this.start, snap.point, this.bindingForStart(snap.point), this.bindingForEnd(snap)))
    return { overlay: true }
  }

  onPointerUp(info: PointerInfo, ctx: ToolContext): ToolResult {
    if (!this.start) return {}
    const snap = snapEndpoint(info.world, ctx.store.getSnapshot(), {
      threshold: worldThreshold(ctx),
      origin: this.start,
    })
    const start = this.start
    const startBinding = this.bindingForStart(snap.point)
    const endBinding = this.bindingForEnd(snap)
    this.reset(ctx)
    if (Math.hypot(snap.point.x - start.x, snap.point.y - start.y) < MIN_LENGTH) return { overlay: true }
    const arrow = this.build(ctx, start, snap.point, startBinding, endBinding)
    ctx.store.transact((api) => api.addElement(arrow))
    ctx.store.stopCapturing()
    ctx.store.setUiState({ selectedIds: new Set([arrow.id]), activeTool: 'select' })
    return { scene: true, overlay: true }
  }

  onDeactivate(ctx: ToolContext): void {
    this.reset(ctx)
  }

  private reset(ctx: ToolContext): void {
    this.start = null
    this.startTarget = null
    ctx.setPreview(null)
    ctx.setGuides([])
    ctx.setPortTarget(null)
  }

  private bindingForStart(end: Point): Binding | undefined {
    if (!this.start || !this.startTarget) return undefined
    return createBinding(this.startTarget, this.start, 0, end)
  }

  private bindingForEnd(snap: { point: Point; target: Element | null }): Binding | undefined {
    if (!this.start || !snap.target) return undefined
    return createBinding(snap.target, snap.point, 0, this.start)
  }

  private build(
    ctx: ToolContext,
    start: Point,
    end: Point,
    startBinding?: Binding,
    endBinding?: Binding,
  ): ArrowElement {
    const arrow = createArrow({
      type: this.id,
      points: [start, end],
      start: startBinding,
      end: endBinding,
      style: ctx.store.getLastUsedStyle(),
    })
    const route = resolveArrowPoints(arrow, { ...ctx.store.getSnapshot().elements, [arrow.id]: arrow })
    return { ...arrow, ...pointsBounds(route), route }
  }
}

function worldThreshold(ctx: ToolContext): number {
  return SNAP_DISTANCE / ctx.camera.zoom
}

export function isArrowElement(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}
