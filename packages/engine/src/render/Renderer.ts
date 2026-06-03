import { Camera } from '../geometry/Camera.js'
import { expand, intersects, type Rect } from '../geometry/rect.js'
import type { SelectionFrame } from '../geometry/handles.js'
import type { SnapGuide } from '../geometry/snap.js'
import {
  defaultGridConfig,
  gridLineValues,
  gridStepForZoom,
  isMajorGridValue,
  type GridConfig,
} from '../geometry/grid.js'
import type { ArrowElement, Element, SceneSnapshot } from '../model/types.js'
import { paintElement } from './painters/index.js'
import { invertingContext } from './invert.js'
import { paintHover, paintMarquee, paintSelection } from './overlay/selection.js'
import { paintPorts, paintTargetHighlight } from './overlay/ports.js'
import { paintArrowHandles } from './overlay/arrowHandles.js'
import { paintGuides } from './overlay/guides.js'

export interface SpawnPreview {
  target: Element
  arrow: ArrowElement
}

export interface OverlayState {
  preview?: Element | null
  spawnPreview?: SpawnPreview | null
  selection?: SelectionFrame | null
  selectedArrows?: ArrowElement[]
  hover?: Element | null
  ports?: Element | null
  targetHighlight?: Element | null
  guides?: SnapGuide[]
  marquee?: Rect | null
}

export interface GridStyle extends GridConfig {
  lineWidth: number
  majorLineWidth: number
  color: string
  majorColor: string
  background: string
}

const defaultGrid: GridStyle = {
  ...defaultGridConfig,
  lineWidth: 1,
  majorLineWidth: 1,
  color: 'rgba(31, 41, 55, 0.035)',
  majorColor: 'rgba(31, 41, 55, 0.09)',
  background: '#ffffff',
}

function elementBounds(element: SceneSnapshot['elements'][string]): Rect {
  return { x: element.x, y: element.y, width: element.width, height: element.height }
}

export class Renderer {
  private readonly scene: HTMLCanvasElement
  private readonly overlay: HTMLCanvasElement
  private readonly sceneCtx: CanvasRenderingContext2D
  private readonly overlayCtx: CanvasRenderingContext2D
  private readonly invertedSceneCtx: CanvasRenderingContext2D
  private readonly invertedOverlayCtx: CanvasRenderingContext2D
  private readonly grid: GridStyle
  private dpr = 1
  private cssWidth = 0
  private cssHeight = 0
  private dark = false

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
    this.invertedSceneCtx = invertingContext(sceneCtx)
    this.invertedOverlayCtx = invertingContext(overlayCtx)
    this.grid = { ...defaultGrid, ...grid }
  }

  setDark(dark: boolean): void {
    this.dark = dark
  }

  private get drawCtx(): CanvasRenderingContext2D {
    return this.dark ? this.invertedSceneCtx : this.sceneCtx
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
    const { dpr, cssWidth, cssHeight, grid } = this
    const ctx = this.drawCtx
    const scale = dpr * camera.zoom

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = grid.background
    ctx.fillRect(0, 0, cssWidth * dpr, cssHeight * dpr)

    ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)

    const viewport = camera.viewportWorldRect(cssWidth, cssHeight)
    this.paintGrid(viewport, camera.zoom)
    this.paintElements(snapshot, viewport, editingId)
  }

  renderOverlay(camera: Camera, overlay: OverlayState = {}): void {
    const { overlayCtx: ctx, dpr, cssWidth, cssHeight } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cssWidth * dpr, cssHeight * dpr)

    const scale = dpr * camera.zoom
    const worldCtx = this.dark ? this.invertedOverlayCtx : ctx
    if (overlay.preview) {
      worldCtx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)
      paintElement(worldCtx, overlay.preview)
    }
    if (overlay.spawnPreview) {
      worldCtx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)
      paintElement(worldCtx, overlay.spawnPreview.arrow)
      paintElement(worldCtx, overlay.spawnPreview.target)
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
    if (overlay.marquee) paintMarquee(ctx, overlay.marquee, camera)
  }

  private paintGrid(viewport: Rect, zoom: number): void {
    const endX = viewport.x + viewport.width
    const endY = viewport.y + viewport.height
    const step = gridStepForZoom(this.grid, zoom)
    const xLines = gridLineValues(viewport.x, endX, step)
    const yLines = gridLineValues(viewport.y, endY, step)

    this.paintGridLines(xLines, yLines, viewport.x, endX, viewport.y, endY, false, zoom)
    this.paintGridLines(xLines, yLines, viewport.x, endX, viewport.y, endY, true, zoom)
  }

  private paintGridLines(
    xLines: number[],
    yLines: number[],
    startX: number,
    endX: number,
    startY: number,
    endY: number,
    major: boolean,
    zoom: number,
  ): void {
    const ctx = this.drawCtx
    const { grid } = this
    ctx.save()
    ctx.strokeStyle = major ? grid.majorColor : grid.color
    ctx.lineWidth = (major ? grid.majorLineWidth : grid.lineWidth) / zoom
    ctx.beginPath()
    for (const x of xLines) {
      if (isMajorGridValue(x, grid) !== major) continue
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
    }
    for (const y of yLines) {
      if (isMajorGridValue(y, grid) !== major) continue
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  private paintElements(snapshot: SceneSnapshot, viewport: Rect, editingId: string | null): void {
    const ctx = this.drawCtx
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
