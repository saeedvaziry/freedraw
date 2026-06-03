import { ImageCache, type BlobLoader } from '../assets/imageCache.js'
import { Camera } from '../geometry/Camera.js'
import { contentBounds, fitCamera } from '../geometry/fit.js'
import { selectionFrameFor } from '../geometry/selectionFrame.js'
import type { Rect } from '../geometry/rect.js'
import type { SnapGuide } from '../geometry/snap.js'
import { InputManager } from '../input/InputManager.js'
import type { ArrowElement, Element, ElementId, Label, Point, ShapeType } from '../model/types.js'
import {
  spawnConnectedShape,
  type SpawnDirection,
  type SpawnMenuRequest,
} from '../connectors/spawn.js'
import type { EditListener, EditRequest } from '../text/edit.js'
import { measureTextBox, type TextSize } from '../text/size.js'
import type { Style } from '../model/types.js'
import { createRenderLoop, type RenderLoopHandle } from '../render/loop.js'
import { Renderer, type OverlayState, type SpawnPreview } from '../render/Renderer.js'
import { setImageCache } from '../render/painters/image.js'
import { clearTextLayoutCache } from '../render/painters/text.js'
import { SKETCH_FONT_FAMILY } from '../text/measure.js'
import type { SceneStore } from '../store/SceneStore.js'
import { ToolManager } from '../tools/ToolManager.js'
import type { ToolContext, ToolResult } from '../tools/Tool.js'

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}

const ZOOM_SENSITIVITY = 0.0015
const WHEEL_COMMIT_DELAY = 150

type Cleanup = () => void
type SpawnMenuListener = (request: SpawnMenuRequest | null) => void

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
  private readonly editListeners = new Set<EditListener>()
  private readonly spawnMenuListeners = new Set<SpawnMenuListener>()
  private isSpaceDown = false
  private isSpacePanning = false
  private spacePanLast = { x: 0, y: 0 }
  private wheelCommitTimer: ReturnType<typeof setTimeout> | null = null
  private readonly imageCache: ImageCache
  private blobLoader: BlobLoader = () => Promise.resolve(undefined)
  private lastPointerScreen: Point | null = null
  private darkMode = false

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
    this.loop = createRenderLoop(() => this.paint())
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
    }
    this.tools = new ToolManager(this.toolContext)
    this.input = new InputManager(overlay, this.camera, {
      getActiveTool: () => this.tools.activeTool,
      context: this.toolContext,
      onResult: (result) => this.applyResult(result),
      onWheel: (event) => this.onWheel(event),
      onPointerInfo: (info) => {
        this.lastPointerScreen = info.screen
      },
    })
  }

  mount(): Cleanup {
    this.resize()
    this.loop.start()

    this.cleanups.push(this.store.subscribe(() => this.loop.markDirty()))
    this.cleanups.push(
      this.store.subscribeUi(() => {
        this.syncTool()
        this.loop.markDirty()
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
    this.cleanups.forEach((fn) => fn())
    this.cleanups.length = 0
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

  spawnShapeFromMenu(sourceId: ElementId, direction: SpawnDirection, type: ShapeType): void {
    this.closeSpawnMenu()
    const source = this.store.getSnapshot().elements[sourceId]
    if (!source) return
    const targetId = spawnConnectedShape(this.store, source, direction, type)
    const target = this.store.getSnapshot().elements[targetId]
    if (!target) return
    this.beginEdit({
      elementId: target.id,
      target: 'label',
      text: '',
      world: { x: target.x, y: target.y, width: target.width, height: target.height },
      style: target.style,
      align: target.style.textAlign,
      verticalAlign: 'middle',
    })
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

  private beginEdit(request: EditRequest): void {
    this.editRequest = request
    this.store.stopCapturing()
    this.loop.markDirty()
    this.editListeners.forEach((listener) => listener(request))
  }

  commitText(elementId: ElementId, target: EditRequest['target'], text: string): void {
    const trimmed = text
    const request = this.editRequest
    const element = this.store.getSnapshot().elements[elementId]
    this.endEdit()
    if (!element) return

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

    const nextLabel: Label | undefined =
      trimmed.length === 0
        ? undefined
        : {
            text: trimmed,
            align: element.label?.align ?? request?.align ?? element.style.textAlign,
            verticalAlign: element.label?.verticalAlign ?? request?.verticalAlign ?? 'middle',
          }
    this.store.transact((api) => api.updateElement(elementId, { label: nextLabel }))
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
    this.loop.markDirty()
    this.editListeners.forEach((listener) => listener(null))
  }

  private syncTool(): void {
    const ui = this.store.getUiState()
    this.tools.setActive(ui.activeTool, { shapeType: ui.activeShapeType })
    this.overlay.style.cursor = cursorFor(ui.activeTool)
  }

  private applyResult(result: ToolResult | void): void {
    if (!result) return
    if (result.scene || result.overlay) this.loop.markDirty()
  }

  private resize(): void {
    this.renderer.resize()
    this.loop.markDirty()
  }

  private paint(): void {
    const snapshot = this.store.getSnapshot()
    const editingId = this.editRequest?.elementId ?? null
    this.renderer.renderScene(snapshot, this.camera, editingId)
    this.renderer.renderOverlay(this.camera, this.buildOverlay())
  }

  private buildOverlay(): OverlayState {
    const snapshot = this.store.getSnapshot()
    const ui = this.store.getUiState()
    const selected = elementsFor(ui.selectedIds, snapshot.elements)
    const shapes = selected.filter((element) => !isArrow(element))
    const selectedArrows = selected.filter(isArrow)
    const selection = selectionFrameFor(shapes)
    const hovered =
      ui.hoveredId && !ui.selectedIds.has(ui.hoveredId)
        ? snapshot.elements[ui.hoveredId] ?? null
        : null
    const hover = hovered && isArrow(hovered) ? hovered : null
    const ports = hovered && !isArrow(hovered) ? hovered : null
    const targetHighlight = this.portTargetId ? snapshot.elements[this.portTargetId] ?? null : null
    return {
      preview: this.preview,
      spawnPreview: this.spawnPreview,
      selection,
      selectedArrows,
      hover,
      ports,
      targetHighlight,
      guides: this.guides,
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
    fonts.load(`16px ${SKETCH_FONT_FAMILY}`).then(() => {
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
