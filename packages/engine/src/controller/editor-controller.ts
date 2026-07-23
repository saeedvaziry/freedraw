import { ImageCache, type BlobLoader } from '../assets/image-cache.js'
import { Camera } from '../geometry/camera.js'
import { contentBounds, fitCamera } from '../geometry/fit.js'
import { selectionFrameFor } from '../geometry/selection-frame.js'
import { labelRect } from '../geometry/shape-outline.js'
import { labelEditRequest } from '../text/label-edit.js'
import { arrowRoute } from '../connectors/resolve.js'
import { arrowLabelEditRect } from '../text/arrow-label.js'
import type { Rect } from '../geometry/rect.js'
import type { SnapGuide } from '../geometry/snap.js'
import { InputManager } from '../input/input-manager.js'
import type { PinchDelta } from '../input/pinch.js'
import type { CameraState, Element, ElementId, Label, Point, ShapeType } from '../model/types.js'
import { isArrowElement } from '../model/guards.js'
import {
  spawnConnectedShape,
  type SpawnDirection,
  type SpawnMenuRequest,
} from '../connectors/spawn.js'
import type { EditListener, EditRequest } from '../text/edit.js'
import { measureTextBox, type TextSize } from '../text/size.js'
import { fitShapeToLabel } from '../text/label-size.js'
import { elementBounds } from '../geometry/hit-test.js'
import type { Style } from '../model/types.js'
import { createRenderLoop, type RenderDirty, type RenderLoopHandle } from '../render/loop.js'
import { Renderer, type OverlayState, type SpawnPreview } from '../render/renderer.js'
import {
  canvasToBlob,
  exportImageAssetIds,
  renderSceneToCanvas,
  type ExportFormat,
} from '../render/export-scene.js'
import { setImageCache } from '../render/painters/image.js'
import { clearTextLayoutCache } from '../render/painters/text.js'
import { clearDrawCaches, sweepDrawCaches } from '../render/draw-cache.js'
import { HANDWRITTEN_FONT_FAMILY } from '../text/measure.js'
import type { SceneStore } from '../store/scene-store.js'
import { ToolManager } from '../tools/tool-manager.js'
import type { ContextMenuRequest, ToolContext, ToolResult } from '../tools/tool.js'

const GROWABLE_TYPES = new Set<string>([
  'rect',
  'roundRect',
  'ellipse',
  'diamond',
  'triangle',
  'cylinder',
  'hexagon',
  'parallelogram',
  'star',
  'cloud',
  'heart',
  'lightning',
  'sticky',
])

function canGrowForLabel(element: Element): boolean {
  return GROWABLE_TYPES.has(element.type)
}

const ZOOM_SENSITIVITY = 0.0015
const WHEEL_COMMIT_DELAY = 150

type Cleanup = () => void
type SpawnMenuListener = (request: SpawnMenuRequest | null) => void
type ContextMenuListener = (request: ContextMenuRequest | null) => void

export interface FlowContext {
  editingId: ElementId
  parentId: ElementId
  direction: SpawnDirection
}

export class EditorController {
  readonly camera: Camera
  private readonly renderer: Renderer
  private readonly loop: RenderLoopHandle
  private readonly tools: ToolManager
  private readonly input: InputManager
  private readonly toolContext: ToolContext
  private readonly cleanups: Cleanup[] = []
  private preview: Element | null = null
  private spawnPreview: SpawnPreview | null = null
  private marquee: Rect | null = null
  private guides: SnapGuide[] = []
  private portTargetId: ElementId | null = null
  private editRequest: EditRequest | null = null
  private editFloor: { id: ElementId; rect: Rect } | null = null
  private currentFlow: FlowContext | null = null
  private readonly editListeners = new Set<EditListener>()
  private readonly spawnMenuListeners = new Set<SpawnMenuListener>()
  private readonly contextMenuListeners = new Set<ContextMenuListener>()
  private isSpaceDown = false
  private isSpacePanning = false
  private spacePanLast = { x: 0, y: 0 }
  private wheelCommitTimer: ReturnType<typeof setTimeout> | null = null
  private readonly imageCache: ImageCache
  private blobLoader: BlobLoader = () => Promise.resolve(undefined)
  private lastPointerScreen: Point | null = null
  private darkMode = false
  private readOnly = false
  private elementCount = 0

  constructor(
    private readonly store: SceneStore,
    scene: HTMLCanvasElement,
    private readonly overlay: HTMLCanvasElement,
  ) {
    this.camera = new Camera(store.getSnapshot().appState.camera)
    this.imageCache = new ImageCache({
      loadBlob: (assetId) => this.blobLoader(assetId),
      onReady: () => this.requestRepaint(),
    })
    setImageCache(this.imageCache)
    this.renderer = new Renderer(scene, overlay)
    this.loop = createRenderLoop((dirty) => this.paint(dirty))
    this.toolContext = {
      store,
      camera: this.camera,
      setPreview: (element) => {
        this.preview = element
      },
      setSpawnPreview: (preview) => {
        this.spawnPreview = preview
      },
      setMarquee: (rect) => {
        this.marquee = rect
      },
      setGuides: (guides) => {
        this.guides = guides
      },
      setPortTarget: (id) => {
        this.portTargetId = id
      },
      beginEdit: (request) => this.beginEdit(request),
      requestSpawnMenu: (request) => this.openSpawnMenu(request),
      requestContextMenu: (request) => this.openContextMenu(request),
      spawnChildAndEdit: (sourceId, direction, type) => {
        this.spawnChildAndEdit(sourceId, direction, type)
      },
    }
    this.tools = new ToolManager(this.toolContext)
    this.input = new InputManager(overlay, this.camera, {
      getActiveTool: () => this.tools.activeTool,
      context: this.toolContext,
      onResult: (result) => this.applyResult(result),
      onWheel: (event) => this.onWheel(event),
      onGesture: (delta) => this.onGesture(delta),
      onGestureEnd: () => this.commitCamera(),
      onPointerInfo: (info) => {
        this.lastPointerScreen = info.screen
      },
      isReadOnly: () => this.readOnly,
    })
  }

  /**
   * Toggle read-only mode. Navigation (pan/zoom) stays enabled while every
   * mutation path — tools, text editing, spawn menu — is suppressed. Used for
   * public share links that should be viewable but not editable.
   */
  setReadOnly(readOnly: boolean): void {
    if (this.readOnly === readOnly) return
    this.readOnly = readOnly
    if (readOnly) {
      this.cancelEdit()
      this.closeSpawnMenu()
      this.closeContextMenu()
      this.store.setUiState({ selectedIds: new Set() })
    }
    this.loop.markDirty()
  }

  get isReadOnly(): boolean {
    return this.readOnly
  }

  mount(): Cleanup {
    this.resize()
    this.loop.start()

    this.elementCount = this.store.getSnapshot().order.length
    this.cleanups.push(
      this.store.subscribe(() => {
        this.sweepCachesOnDelete()
        this.loop.markDirty()
      }),
    )
    this.cleanups.push(
      this.store.subscribeUi(() => {
        this.syncTool()
        this.loop.markOverlayDirty()
      }),
    )
    this.syncTool()

    const resizeObserver = new ResizeObserver(() => this.resize())
    resizeObserver.observe(this.overlay)
    this.cleanups.push(() => resizeObserver.disconnect())

    this.attachDprWatch()
    this.cleanups.push(this.input.attach())
    this.attachSpacePan()
    this.attachFontWatch()

    return () => this.unmount()
  }

  private unmount(): void {
    this.loop.stop()
    setImageCache(null)
    clearDrawCaches()
    this.cleanups.forEach((fn) => fn())
    this.cleanups.length = 0
  }

  private sweepCachesOnDelete(): void {
    const order = this.store.getSnapshot().order
    if (order.length < this.elementCount) sweepDrawCaches(new Set(order))
    this.elementCount = order.length
  }

  requestRepaint(): void {
    this.loop.markDirty()
  }

  setDark(dark: boolean): void {
    this.darkMode = dark
    this.renderer.setDark(dark)
    this.loop.markDirty()
    this.editListeners.forEach((listener) => listener(this.editRequest))
  }

  get isDark(): boolean {
    return this.darkMode
  }

  setImageBlobLoader(loader: BlobLoader): void {
    this.blobLoader = loader
  }

  cacheImageBitmap(assetId: string, bitmap: ImageBitmap): void {
    this.imageCache.set(assetId, bitmap)
    this.requestRepaint()
  }

  get viewportSize(): { width: number; height: number } {
    return { width: this.renderer.viewportWidth, height: this.renderer.viewportHeight }
  }

  screenToWorld(point: { x: number; y: number }): { x: number; y: number } {
    return this.camera.screenToWorld(point)
  }

  subscribeEdit(listener: EditListener): () => void {
    this.editListeners.add(listener)
    return () => this.editListeners.delete(listener)
  }

  get activeEdit(): EditRequest | null {
    return this.editRequest
  }

  subscribeSpawnMenu(listener: SpawnMenuListener): () => void {
    this.spawnMenuListeners.add(listener)
    return () => this.spawnMenuListeners.delete(listener)
  }

  private openSpawnMenu(request: SpawnMenuRequest): void {
    this.spawnMenuListeners.forEach((listener) => listener(request))
  }

  closeSpawnMenu(): void {
    this.spawnMenuListeners.forEach((listener) => listener(null))
  }

  subscribeContextMenu(listener: ContextMenuListener): () => void {
    this.contextMenuListeners.add(listener)
    return () => this.contextMenuListeners.delete(listener)
  }

  private openContextMenu(request: ContextMenuRequest): void {
    this.contextMenuListeners.forEach((listener) => listener(request))
  }

  closeContextMenu(): void {
    this.contextMenuListeners.forEach((listener) => listener(null))
  }

  spawnShapeFromMenu(sourceId: ElementId, direction: SpawnDirection, type: ShapeType): void {
    this.closeSpawnMenu()
    this.spawnChildAndEdit(sourceId, direction, type)
  }

  get flowContext(): FlowContext | null {
    return this.currentFlow
  }

  spawnChildAndEdit(
    sourceId: ElementId,
    direction: SpawnDirection,
    type?: ShapeType,
  ): ElementId | null {
    const source = this.store.getSnapshot().elements[sourceId]
    if (!source || isArrowElement(source)) return null
    const targetId = spawnConnectedShape(this.store, source, direction, type)
    const target = this.store.getSnapshot().elements[targetId]
    if (!target) return null
    this.beginEdit({
      elementId: target.id,
      target: 'label',
      text: '',
      world: labelRect(target.type, target),
      style: target.style,
      align: target.style.textAlign,
      verticalAlign: 'middle',
    })
    this.currentFlow = { editingId: target.id, parentId: sourceId, direction }
    return targetId
  }

  beginLabelEditFromText(elementId: ElementId, text: string): void {
    const element = this.store.getSnapshot().elements[elementId]
    if (!element) return
    this.beginEdit(labelEditRequest(element, text, { selectAll: false }))
  }

  worldToScreen(point: { x: number; y: number }): { x: number; y: number } {
    return this.camera.worldToScreen(point)
  }

  get zoom(): number {
    return this.camera.zoom
  }

  get cursorWorldPoint(): Point | null {
    return this.lastPointerScreen ? this.camera.screenToWorld(this.lastPointerScreen) : null
  }

  get viewportCenter(): Point {
    const { width, height } = this.viewportSize
    return this.camera.screenToWorld({ x: width / 2, y: height / 2 })
  }

  getViewport(): CameraState {
    return this.camera.state
  }

  focusViewport(state: CameraState): void {
    this.camera.setState(state)
    this.commitCamera()
  }

  zoomToFit(): void {
    const bounds = contentBounds(this.store.getSnapshot())
    const { width, height } = this.viewportSize
    if (!bounds || width === 0 || height === 0) return
    this.camera.setState(fitCamera(bounds, width, height))
    this.commitCamera()
  }

  zoomToActualSize(): void {
    const { width, height } = this.viewportSize
    const center = this.camera.screenToWorld({ x: width / 2, y: height / 2 })
    this.camera.zoomToScreenPoint(1, this.camera.worldToScreen(center))
    this.commitCamera()
  }

  async exportImage(options: ExportImageOptions): Promise<Blob | null> {
    const snapshot = this.store.getSnapshot()
    await this.imageCache.ensureBitmaps(exportImageAssetIds(snapshot))
    const canvas = renderSceneToCanvas(snapshot, {
      format: options.format,
      scale: options.scale,
      background: exportBackground(options),
      dark: options.dark,
    })
    if (!canvas) return null
    return canvasToBlob(canvas, { format: options.format })
  }

  async copyImageToClipboard(options?: Partial<ExportImageOptions>): Promise<boolean> {
    const blob = await this.exportImage({
      format: 'png',
      transparent: false,
      dark: this.darkMode,
      ...options,
    })
    if (!blob) return false
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    return true
  }

  measureTextSize(text: string, style: Style): TextSize {
    return measureTextBox(text, style)
  }

  elementCenterScreen(elementId: ElementId): { x: number; y: number } | null {
    const element = this.store.getSnapshot().elements[elementId]
    if (!element) return null
    return this.camera.worldToScreen({
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
    })
  }

  resizeTextWhileEditing(elementId: ElementId, text: string): void {
    const element = this.store.getSnapshot().elements[elementId]
    if (!element || element.type !== 'text') return
    const size = measureTextBox(text, element.style)
    if (size.width === element.width && size.height === element.height) return
    const cx = element.x + element.width / 2
    const cy = element.y + element.height / 2
    this.store.transact((api) =>
      api.updateElement(elementId, {
        width: size.width,
        height: size.height,
        x: cx - size.width / 2,
        y: cy - size.height / 2,
      }),
    )
  }

  resizeShapeForLabel(elementId: ElementId, text: string): void {
    const element = this.store.getSnapshot().elements[elementId]
    if (element && isArrowElement(element)) {
      this.resizeArrowLabelWhileEditing(element, text)
      return
    }
    if (!element || !canGrowForLabel(element)) return
    const next = this.sizeForLabel(element, text)
    if (
      next.width === element.width &&
      next.height === element.height &&
      next.x === element.x &&
      next.y === element.y
    ) {
      return
    }
    this.store.transact((api) => api.updateElement(elementId, next))
    const request = this.editRequest
    if (request && request.elementId === elementId) {
      this.editRequest = { ...request, world: labelRect(element.type, next) }
    }
  }

  private resizeArrowLabelWhileEditing(element: Element, text: string): void {
    if (!isArrowElement(element)) return
    const request = this.editRequest
    if (!request || request.elementId !== element.id || request.target !== 'label') return
    const world = arrowLabelEditRect(arrowRoute(element), text, element.style)
    if (
      world.x === request.world.x &&
      world.y === request.world.y &&
      world.width === request.world.width &&
      world.height === request.world.height
    ) {
      return
    }
    this.editRequest = { ...request, labelKind: 'arrow', world }
  }

  private floorFor(element: Element): Rect {
    if (this.editFloor?.id === element.id) return this.editFloor.rect
    const { baseWidth, baseHeight } = element.label ?? {}
    if (baseWidth === undefined || baseHeight === undefined) return elementBounds(element)
    const cx = element.x + element.width / 2
    const cy = element.y + element.height / 2
    return { width: baseWidth, height: baseHeight, x: cx - baseWidth / 2, y: cy - baseHeight / 2 }
  }

  private sizeForLabel(element: Element, text: string): Rect {
    const floor = this.floorFor(element)
    return fitShapeToLabel(element.type, floor, text, element.style) ?? floor
  }

  private beginEdit(request: EditRequest): void {
    this.currentFlow = null
    this.editRequest = request
    const element = this.store.getSnapshot().elements[request.elementId]
    this.editFloor =
      element && canGrowForLabel(element) ? { id: element.id, rect: this.floorFor(element) } : null
    this.store.stopCapturing()
    this.loop.markDirty()
    this.editListeners.forEach((listener) => listener(request))
  }

  commitText(elementId: ElementId, target: EditRequest['target'], text: string): void {
    const trimmed = text
    const request = this.editRequest
    const element = this.store.getSnapshot().elements[elementId]
    const floor = element ? this.floorFor(element) : null
    this.endEdit()
    if (!element || !floor) return

    if (target === 'text') {
      if (trimmed.length === 0) {
        this.store.deleteElements([elementId])
        return
      }
      const size = measureTextBox(trimmed, element.style)
      const cx = element.x + element.width / 2
      const cy = element.y + element.height / 2
      this.store.transact((api) =>
        api.updateElement(elementId, {
          text: trimmed,
          width: size.width,
          height: size.height,
          x: cx - size.width / 2,
          y: cy - size.height / 2,
        }),
      )
      this.store.stopCapturing()
      return
    }

    const growable = canGrowForLabel(element)
    const nextLabel: Label | undefined =
      trimmed.length === 0
        ? undefined
        : {
            text: trimmed,
            align: element.label?.align ?? request?.align ?? element.style.textAlign,
            verticalAlign: element.label?.verticalAlign ?? request?.verticalAlign ?? 'middle',
            ...(growable ? { baseWidth: floor.width, baseHeight: floor.height } : {}),
          }
    const size = growable ? (fitShapeToLabel(element.type, floor, trimmed, element.style) ?? floor) : null
    this.store.transact((api) =>
      api.updateElement(elementId, { label: nextLabel, ...(size ?? {}) }),
    )
    this.store.stopCapturing()
  }

  cancelEdit(): void {
    const request = this.editRequest
    this.endEdit()
    if (request && request.target === 'text' && request.text.length === 0) {
      this.store.deleteElements([request.elementId])
    }
  }

  private endEdit(): void {
    if (!this.editRequest) return
    this.editRequest = null
    this.editFloor = null
    this.currentFlow = null
    this.loop.markDirty()
    this.editListeners.forEach((listener) => listener(null))
  }

  private syncTool(): void {
    const ui = this.store.getUiState()
    this.tools.setActive(ui.activeTool, {
      shapeType: ui.activeShapeType,
      stickyColor: ui.activeStickyColor,
    })
    this.overlay.style.cursor = cursorFor(ui.activeTool)
  }

  private applyResult(result: ToolResult | void): void {
    if (!result) return
    if (result.scene) this.loop.markSceneDirty()
    if (result.overlay) this.loop.markOverlayDirty()
  }

  private resize(): void {
    this.renderer.resize()
    this.loop.markDirty()
  }

  private paint(dirty: RenderDirty): void {
    const snapshot = this.store.getSnapshot()
    if (dirty.scene) {
      const editingId = this.editRequest?.elementId ?? null
      this.renderer.renderScene(snapshot, this.camera, editingId)
    }
    if (dirty.overlay) {
      this.renderer.renderOverlay(this.camera, this.buildOverlay())
    }
  }

  private buildOverlay(): OverlayState {
    const snapshot = this.store.getSnapshot()
    const ui = this.store.getUiState()
    const hoveredId = this.store.getHoveredId()
    const selected = elementsFor(ui.selectedIds, snapshot.elements)
    const shapes = selected.filter((element) => !isArrowElement(element))
    const selectedArrows = selected.filter(isArrowElement)
    const selection = selectionFrameFor(shapes)
    const hovered =
      hoveredId && !ui.selectedIds.has(hoveredId)
        ? snapshot.elements[hoveredId] ?? null
        : null
    const hover = hovered && isArrowElement(hovered) ? hovered : null
    const ports = shapes
    const targetHighlight = this.portTargetId ? snapshot.elements[this.portTargetId] ?? null : null
    return {
      preview: this.preview,
      spawnPreview: this.spawnPreview,
      selection,
      selectedArrows,
      hover,
      ports,
      targetHighlight,
      guides: snapshot.appState.snapGuidesEnabled ? this.guides : [],
      marquee: this.marquee,
    }
  }

  private commitCamera(): void {
    this.store.commitCamera(this.camera.state)
    this.loop.markDirty()
  }

  private attachFontWatch(): void {
    const fonts = typeof document !== 'undefined' ? document.fonts : null
    if (!fonts) return
    fonts.load(`16px ${HANDWRITTEN_FONT_FAMILY}`).then(() => {
      clearTextLayoutCache()
      this.loop.markDirty()
    })
  }

  private attachDprWatch(): void {
    let query: MediaQueryList | null = null
    const onChange = (): void => {
      this.resize()
      watch()
    }
    const watch = (): void => {
      query?.removeEventListener('change', onChange)
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      query.addEventListener('change', onChange)
    }
    watch()
    this.cleanups.push(() => query?.removeEventListener('change', onChange))
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault()
    const point = this.localPoint(event.clientX, event.clientY)
    this.lastPointerScreen = point
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY * 4)
      this.camera.zoomToScreenPoint(this.camera.zoom * factor, point)
    } else {
      this.camera.panByScreen(-event.deltaX, -event.deltaY)
    }
    this.loop.markDirty()
    this.scheduleCameraCommit()
  }

  private onGesture(delta: PinchDelta): void {
    this.lastPointerScreen = delta.center
    this.camera.panByScreen(delta.panX, delta.panY)
    if (delta.scale !== 1) {
      this.camera.zoomToScreenPoint(this.camera.zoom * delta.scale, delta.center)
    }
    this.loop.markDirty()
  }

  private scheduleCameraCommit(): void {
    if (this.wheelCommitTimer !== null) clearTimeout(this.wheelCommitTimer)
    this.wheelCommitTimer = setTimeout(() => {
      this.wheelCommitTimer = null
      this.commitCamera()
    }, WHEEL_COMMIT_DELAY)
  }

  private attachSpacePan(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return
      event.preventDefault()
      this.isSpaceDown = true
      this.overlay.style.cursor = 'grab'
    }
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code !== 'Space') return
      this.isSpaceDown = false
      this.syncTool()
    }
    const onDown = (event: PointerEvent): void => {
      if (!(event.button === 1 || (event.button === 0 && this.isSpaceDown))) return
      event.stopImmediatePropagation()
      try {
        this.overlay.setPointerCapture(event.pointerId)
      } catch {
        return
      }
      this.isSpacePanning = true
      this.spacePanLast = { x: event.clientX, y: event.clientY }
      this.lastPointerScreen = this.localPoint(event.clientX, event.clientY)
    }
    const onMove = (event: PointerEvent): void => {
      if (!this.isSpacePanning) return
      event.stopImmediatePropagation()
      this.camera.panByScreen(event.clientX - this.spacePanLast.x, event.clientY - this.spacePanLast.y)
      this.spacePanLast = { x: event.clientX, y: event.clientY }
      this.lastPointerScreen = this.localPoint(event.clientX, event.clientY)
      this.loop.markDirty()
    }
    const onUp = (event: PointerEvent): void => {
      if (!this.isSpacePanning) return
      event.stopImmediatePropagation()
      this.isSpacePanning = false
      if (this.overlay.hasPointerCapture(event.pointerId)) {
        this.overlay.releasePointerCapture(event.pointerId)
      }
      this.commitCamera()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    this.overlay.addEventListener('pointerdown', onDown, true)
    this.overlay.addEventListener('pointermove', onMove, true)
    this.overlay.addEventListener('pointerup', onUp, true)
    this.overlay.addEventListener('pointercancel', onUp, true)
    this.cleanups.push(() => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      this.overlay.removeEventListener('pointerdown', onDown, true)
      this.overlay.removeEventListener('pointermove', onMove, true)
      this.overlay.removeEventListener('pointerup', onUp, true)
      this.overlay.removeEventListener('pointercancel', onUp, true)
      if (this.wheelCommitTimer !== null) clearTimeout(this.wheelCommitTimer)
    })
  }

  private localPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.overlay.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }
}

export interface ExportImageOptions {
  format: ExportFormat
  transparent: boolean
  dark?: boolean
  scale?: number
}

const EXPORT_BASE_BACKGROUND = '#ffffff'

function exportBackground(options: ExportImageOptions): string | null {
  if (options.format === 'png' && options.transparent) return null
  return EXPORT_BASE_BACKGROUND
}

function elementsFor(ids: Set<ElementId>, elements: Record<ElementId, Element>): Element[] {
  const result: Element[] = []
  for (const id of ids) {
    const element = elements[id]
    if (element) result.push(element)
  }
  return result
}

function cursorFor(toolId: string): string {
  if (toolId === 'hand') return 'grab'
  if (toolId === 'shape' || toolId === 'arrow' || toolId === 'line' || toolId === 'freedraw')
    return 'crosshair'
  return 'default'
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
