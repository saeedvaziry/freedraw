import { Camera } from '../geometry/Camera.js'
import { expand, intersects, type Rect } from '../geometry/rect.js'
import type { SelectionFrame } from '../geometry/handles.js'
import type { SnapGuide } from '../geometry/snap.js'
import type { ArrowElement, Element, SceneSnapshot } from '../model/types.js'
import { getPainter } from './painters/index.js'
import { paintHover, paintMarquee, paintSelection } from './overlay/selection.js'
import { paintPorts, paintTargetHighlight } from './overlay/ports.js'
import { paintArrowHandles } from './overlay/arrowHandles.js'
import { paintGuides } from './overlay/guides.js'

export interface OverlayState {
  preview?: Element | null
  selection?: SelectionFrame | null
  selectedArrows?: ArrowElement[]
  hover?: Element | null
  ports?: Element | null
  targetHighlight?: Element | null
  guides?: SnapGuide[]
  marquee?: Rect | null
}

export interface GridStyle {
  spacing: number
  dotRadius: number
  color: string
  background: string
}

const defaultGrid: GridStyle = {
  spacing: 24,
  dotRadius: 1,
  color: 'rgba(120, 120, 130, 0.35)',
  background: '#fafafa',
}

function elementBounds(element: SceneSnapshot['elements'][string]): Rect {
  return { x: element.x, y: element.y, width: element.width, height: element.height }
}

export class Renderer {
  private readonly scene: HTMLCanvasElement
  private readonly overlay: HTMLCanvasElement
  private readonly sceneCtx: CanvasRenderingContext2D
  private readonly overlayCtx: CanvasRenderingContext2D
  private readonly grid: GridStyle
  private dpr = 1
  private cssWidth = 0
  private cssHeight = 0

  constructor(
    scene: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
    grid: Partial<GridStyle> = {},
  ) {
    const sceneCtx = scene.getContext('2d')
    const overlayCtx = overlay.getContext('2d')
    if (!sceneCtx || !overlayCtx) throw new Error('2D canvas context unavailable')
    this.scene = scene
    this.overlay = overlay
    this.sceneCtx = sceneCtx
    this.overlayCtx = overlayCtx
    this.grid = { ...defaultGrid, ...grid }
  }

  get viewportWidth(): number {
    return this.cssWidth
  }

  get viewportHeight(): number {
    return this.cssHeight
  }

  resize(): void {
    const rect = this.scene.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const cssWidth = Math.max(1, Math.round(rect.width))
    const cssHeight = Math.max(1, Math.round(rect.height))

    this.dpr = dpr
    this.cssWidth = cssWidth
    this.cssHeight = cssHeight

    for (const canvas of [this.scene, this.overlay]) {
      canvas.width = Math.round(cssWidth * dpr)
      canvas.height = Math.round(cssHeight * dpr)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`
    }
  }

  renderScene(snapshot: SceneSnapshot, camera: Camera, editingId: string | null = null): void {
    const { sceneCtx: ctx, dpr, cssWidth, cssHeight, grid } = this
    const scale = dpr * camera.zoom

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = grid.background
    ctx.fillRect(0, 0, cssWidth * dpr, cssHeight * dpr)

    ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)

    const viewport = camera.viewportWorldRect(cssWidth, cssHeight)
    this.paintGrid(viewport)
    this.paintElements(snapshot, viewport, editingId)
  }

  renderOverlay(camera: Camera, overlay: OverlayState = {}): void {
    const { overlayCtx: ctx, dpr, cssWidth, cssHeight } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cssWidth * dpr, cssHeight * dpr)

    const scale = dpr * camera.zoom
    if (overlay.preview) {
      ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)
      paintElement(ctx, overlay.preview)
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (overlay.hover) paintHover(ctx, overlay.hover, camera)
    if (overlay.selection) paintSelection(ctx, overlay.selection, camera)
    if (overlay.selectedArrows) {
      for (const arrow of overlay.selectedArrows) paintArrowHandles(ctx, arrow, camera)
    }
    if (overlay.ports) paintPorts(ctx, overlay.ports, camera)
    if (overlay.targetHighlight) paintTargetHighlight(ctx, overlay.targetHighlight, camera)
    if (overlay.guides) paintGuides(ctx, overlay.guides, camera)
    if (overlay.marquee) paintMarquee(ctx, overlay.marquee)
  }

  private paintGrid(viewport: Rect): void {
    const { sceneCtx: ctx, grid } = this
    const { spacing, dotRadius, color } = grid
    const startX = Math.floor(viewport.x / spacing) * spacing
    const startY = Math.floor(viewport.y / spacing) * spacing
    const endX = viewport.x + viewport.width
    const endY = viewport.y + viewport.height
    ctx.fillStyle = color
    for (let y = startY; y <= endY; y += spacing) {
      for (let x = startX; x <= endX; x += spacing) {
        ctx.beginPath()
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  private paintElements(snapshot: SceneSnapshot, viewport: Rect, editingId: string | null): void {
    const { sceneCtx: ctx } = this
    for (const id of snapshot.order) {
      const element = snapshot.elements[id]
      if (!element) continue
      const bounds = expand(elementBounds(element), element.style.strokeWidth)
      if (!intersects(bounds, viewport)) continue
      paintElement(ctx, id === editingId ? withoutText(element) : element)
    }
  }
}

function withoutText(element: Element): Element {
  if (element.type === 'text') return { ...element, text: '' }
  if (element.label) return { ...element, label: undefined }
  return element
}

function paintElement(ctx: CanvasRenderingContext2D, element: Element): void {
  const painter = getPainter(element.type)
  if (!painter) return
  if (!element.rotation) {
    painter(ctx, element)
    return
  }
  const cx = element.x + element.width / 2
  const cy = element.y + element.height / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(element.rotation)
  ctx.translate(-cx, -cy)
  painter(ctx, element)
  ctx.restore()
}
