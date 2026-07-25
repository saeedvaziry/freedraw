import { Camera } from '../geometry/camera.js'
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
import { CanvasDrawTarget } from './draw-target.js'
import { invertColor } from './invert.js'
import {
  DEFAULT_CANVAS_COLORS,
  overlayColorsFrom,
  resolveCanvasColors,
  type CanvasColorOverrides,
  type CanvasColors,
} from './color-config.js'
import { paintHover, paintLockBadge, paintMarquee, paintSelection } from './overlay/selection.js'
import { paintPorts, paintTargetHighlight } from './overlay/ports.js'
import { paintArrowHandles } from './overlay/arrow-handles.js'
import { paintGuides } from './overlay/guides.js'
import { paintPresence, type PresenceOverlay } from './overlay/presence.js'

export interface SpawnPreview {
  target: Element
  arrow: ArrowElement
}

export interface OverlayState {
  preview?: Element | null
  transient?: Element[] | null
  spawnPreview?: SpawnPreview | null
  selection?: SelectionFrame | null
  selectedArrows?: ArrowElement[]
  hover?: Element | null
  lockedBadges?: Element[]
  ports?: Element[]
  targetHighlight?: Element | null
  guides?: SnapGuide[]
  marquee?: Rect | null
  presence?: PresenceOverlay | null
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
  color: DEFAULT_CANVAS_COLORS.gridLine,
  majorColor: DEFAULT_CANVAS_COLORS.gridMajor,
  background: DEFAULT_CANVAS_COLORS.gridBackground,
}

function buildGrid(colors: CanvasColors): GridStyle {
  return {
    ...defaultGrid,
    color: colors.gridLine,
    majorColor: colors.gridMajor,
    background: colors.gridBackground,
  }
}

function buildDarkGrid(grid: GridStyle): GridStyle {
  return {
    ...grid,
    color: invertColor(grid.color),
    majorColor: invertColor(grid.majorColor),
    background: invertColor(grid.background),
  }
}

function elementBounds(element: SceneSnapshot['elements'][string]): Rect {
  return { x: element.x, y: element.y, width: element.width, height: element.height }
}

export class Renderer {
  private readonly scene: HTMLCanvasElement
  private readonly overlay: HTMLCanvasElement
  private readonly sceneCtx: CanvasRenderingContext2D
  private readonly overlayCtx: CanvasRenderingContext2D
  private readonly sceneTarget: CanvasDrawTarget
  private readonly overlayTarget: CanvasDrawTarget
  private colors: CanvasColors
  private grid: GridStyle
  private darkGrid: GridStyle
  private dpr = 1
  private cssWidth = 0
  private cssHeight = 0
  private dark = false

  constructor(
    scene: HTMLCanvasElement,
    overlay: HTMLCanvasElement,
    colors: CanvasColorOverrides = {},
  ) {
    const sceneCtx = scene.getContext('2d')
    const overlayCtx = overlay.getContext('2d')
    if (!sceneCtx || !overlayCtx) throw new Error('2D canvas context unavailable')
    this.scene = scene
    this.overlay = overlay
    this.sceneCtx = sceneCtx
    this.overlayCtx = overlayCtx
    this.sceneTarget = new CanvasDrawTarget(sceneCtx)
    this.overlayTarget = new CanvasDrawTarget(overlayCtx)
    this.colors = resolveCanvasColors(colors)
    this.grid = buildGrid(this.colors)
    this.darkGrid = buildDarkGrid(this.grid)
  }

  setDark(dark: boolean): void {
    this.dark = dark
  }

  setColors(colors: CanvasColorOverrides): void {
    this.colors = resolveCanvasColors(colors)
    this.grid = buildGrid(this.colors)
    this.darkGrid = buildDarkGrid(this.grid)
  }

  private get activeGrid(): GridStyle {
    return this.dark ? this.darkGrid : this.grid
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

  renderScene(
    snapshot: SceneSnapshot,
    camera: Camera,
    editingId: string | null = null,
    hiddenIds: ReadonlySet<string> | null = null,
  ): void {
    const { dpr, cssWidth, cssHeight } = this
    const ctx = this.sceneCtx
    const grid = this.activeGrid
    const scale = dpr * camera.zoom

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = grid.background
    ctx.fillRect(0, 0, cssWidth * dpr, cssHeight * dpr)

    ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)

    const viewport = camera.viewportWorldRect(cssWidth, cssHeight)
    this.paintGrid(viewport, camera.zoom)
    this.paintElements(snapshot, viewport, editingId, hiddenIds)
  }

  renderOverlay(camera: Camera, overlay: OverlayState = {}): void {
    const { overlayCtx: ctx, dpr, cssWidth, cssHeight } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cssWidth * dpr, cssHeight * dpr)

    const scale = dpr * camera.zoom
    if (overlay.preview) {
      ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)
      paintElement(this.overlayTarget, overlay.preview, this.dark)
    }
    if (overlay.transient && overlay.transient.length > 0) {
      ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)
      for (const element of overlay.transient) paintElement(this.overlayTarget, element, this.dark)
    }
    if (overlay.spawnPreview) {
      ctx.setTransform(scale, 0, 0, scale, -camera.x * scale, -camera.y * scale)
      paintElement(this.overlayTarget, overlay.spawnPreview.arrow, this.dark)
      paintElement(this.overlayTarget, overlay.spawnPreview.target, this.dark)
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const colors = overlayColorsFrom(this.colors)
    if (overlay.lockedBadges) {
      for (const element of overlay.lockedBadges) paintLockBadge(ctx, element, camera, colors)
    }
    if (overlay.hover) paintHover(ctx, overlay.hover, camera, colors)
    if (overlay.selection) paintSelection(ctx, overlay.selection, camera, colors)
    if (overlay.selectedArrows) {
      for (const arrow of overlay.selectedArrows) paintArrowHandles(ctx, arrow, camera, colors)
    }
    if (overlay.ports) {
      for (const element of overlay.ports) paintPorts(ctx, element, camera, colors)
    }
    if (overlay.targetHighlight) paintTargetHighlight(ctx, overlay.targetHighlight, camera, colors)
    if (overlay.guides) paintGuides(ctx, overlay.guides, camera)
    if (overlay.marquee) paintMarquee(ctx, overlay.marquee, camera, colors)
    if (overlay.presence) paintPresence(ctx, overlay.presence, camera)
  }

  private paintGrid(viewport: Rect, zoom: number): void {
    const endX = viewport.x + viewport.width
    const endY = viewport.y + viewport.height
    const step = gridStepForZoom(this.activeGrid, zoom)
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
    const ctx = this.sceneCtx
    const grid = this.activeGrid
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

  private paintElements(
    snapshot: SceneSnapshot,
    viewport: Rect,
    editingId: string | null,
    hiddenIds: ReadonlySet<string> | null,
  ): void {
    for (const id of snapshot.order) {
      if (hiddenIds?.has(id)) continue
      const element = snapshot.elements[id]
      if (!element) continue
      const bounds = expand(elementBounds(element), element.style.strokeWidth)
      if (!intersects(bounds, viewport)) continue
      paintElement(this.sceneTarget, id === editingId ? withoutText(element) : element, this.dark)
    }
  }
}

function withoutText(element: Element): Element {
  if (element.type === 'text') return { ...element, text: '' }
  if (element.label) return { ...element, label: undefined }
  return element
}
