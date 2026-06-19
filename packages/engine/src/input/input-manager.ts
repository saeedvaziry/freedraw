import type { Camera } from '../geometry/camera.js'
import type { Point } from '../model/types.js'
import { pinchDelta, pinchSample, type PinchDelta, type PinchSample } from './pinch.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from '../tools/tool.js'

export interface InputHandlers {
  getActiveTool(): Tool
  context: ToolContext
  onResult(result: ToolResult | void): void
  onWheel(event: WheelEvent): void
  onGesture(delta: PinchDelta): void
  onGestureEnd(): void
  onPointerInfo?(info: PointerInfo): void
  /**
   * When true, tool interactions (create/select/move/edit) are suppressed while
   * navigation (pan/zoom via wheel and pinch) keeps working. Read each time so
   * the mode can be toggled after the manager is attached.
   */
  isReadOnly?(): boolean
}

type Cleanup = () => void

export class InputManager {
  private readonly cleanups: Cleanup[] = []
  private capturing = false
  private pendingCaptureId: number | null = null
  private readonly activePointers = new Map<number, Point>()
  private gesturePointers: [number, number] | null = null
  private gestureSample: PinchSample | null = null
  private toolPointerId: number | null = null
  private lastToolInfo: PointerInfo | null = null

  constructor(
    private readonly overlay: HTMLCanvasElement,
    private readonly camera: Camera,
    private readonly handlers: InputHandlers,
  ) {}

  attach(): Cleanup {
    this.attachPointer()
    this.attachWheel()
    this.attachKeyboard()
    this.attachDoubleClick()
    this.attachContextMenu()
    return () => this.detach()
  }

  private detach(): void {
    this.cleanups.forEach((fn) => fn())
    this.cleanups.length = 0
  }

  private get readOnly(): boolean {
    return this.handlers.isReadOnly?.() ?? false
  }

  private info(event: PointerEvent | MouseEvent): PointerInfo {
    const screen = this.localPoint(event.clientX, event.clientY)
    return {
      screen,
      world: this.camera.screenToWorld(screen),
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      button: event.button,
    }
  }

  private attachPointer(): void {
    const onDown = (event: PointerEvent): void => {
      this.activePointers.set(event.pointerId, this.localPoint(event.clientX, event.clientY))
      if (this.activePointers.size >= 2) {
        this.beginGesture()
        return
      }
      const tool = this.handlers.getActiveTool()
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      if (this.readOnly || !tool.onPointerDown) return
      this.toolPointerId = event.pointerId
      this.pendingCaptureId = event.pointerId
      this.lastToolInfo = info
      this.handlers.onResult(tool.onPointerDown(info, this.handlers.context))
    }
    const onMove = (event: PointerEvent): void => {
      if (this.activePointers.has(event.pointerId)) {
        this.activePointers.set(event.pointerId, this.localPoint(event.clientX, event.clientY))
      }
      if (this.gesturePointers) {
        this.updateGesture()
        return
      }
      if (this.toolPointerId !== null && event.pointerId !== this.toolPointerId) return
      const tool = this.handlers.getActiveTool()
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      this.lastToolInfo = info
      if (this.readOnly || !tool.onPointerMove) return
      if (this.pendingCaptureId === event.pointerId && !this.capturing) {
        try {
          this.overlay.setPointerCapture(event.pointerId)
          this.capturing = true
        } catch {
          this.capturing = false
        }
        this.pendingCaptureId = null
      }
      this.handlers.onResult(tool.onPointerMove(info, this.handlers.context))
    }
    const onUp = (event: PointerEvent): void => {
      this.activePointers.delete(event.pointerId)
      if (this.gesturePointers) {
        this.endGesture()
        return
      }
      if (this.toolPointerId !== null && event.pointerId !== this.toolPointerId) return
      const tool = this.handlers.getActiveTool()
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      if (this.capturing && this.overlay.hasPointerCapture(event.pointerId)) {
        this.overlay.releasePointerCapture(event.pointerId)
      }
      this.capturing = false
      this.pendingCaptureId = null
      this.toolPointerId = null
      if (this.readOnly || !tool.onPointerUp) return
      this.handlers.onResult(tool.onPointerUp(info, this.handlers.context))
    }
    this.overlay.addEventListener('pointerdown', onDown)
    this.overlay.addEventListener('pointermove', onMove)
    this.overlay.addEventListener('pointerup', onUp)
    this.overlay.addEventListener('pointercancel', onUp)
    this.cleanups.push(() => {
      this.overlay.removeEventListener('pointerdown', onDown)
      this.overlay.removeEventListener('pointermove', onMove)
      this.overlay.removeEventListener('pointerup', onUp)
      this.overlay.removeEventListener('pointercancel', onUp)
    })
  }

  private beginGesture(): void {
    if (this.toolPointerId !== null) {
      this.cancelToolGesture()
    }
    const ids = [...this.activePointers.keys()].slice(0, 2) as [number, number]
    this.gesturePointers = ids
    this.gestureSample = this.sampleFor(ids)
  }

  private updateGesture(): void {
    if (!this.gesturePointers || !this.gestureSample) return
    const next = this.sampleFor(this.gesturePointers)
    if (!next) return
    this.handlers.onGesture(pinchDelta(this.gestureSample, next))
    this.gestureSample = next
  }

  private endGesture(): void {
    if (this.activePointers.size >= 2) {
      this.gesturePointers = [...this.activePointers.keys()].slice(0, 2) as [number, number]
      this.gestureSample = this.sampleFor(this.gesturePointers)
      return
    }
    this.gesturePointers = null
    this.gestureSample = null
    this.handlers.onGestureEnd()
  }

  private sampleFor(ids: [number, number]): PinchSample | null {
    const a = this.activePointers.get(ids[0])
    const b = this.activePointers.get(ids[1])
    if (!a || !b) return null
    return pinchSample(a, b)
  }

  private cancelToolGesture(): void {
    const tool = this.handlers.getActiveTool()
    if (this.toolPointerId !== null && this.capturing) {
      try {
        this.overlay.releasePointerCapture(this.toolPointerId)
      } catch {
        // capture already released
      }
    }
    if (tool.onPointerUp && this.lastToolInfo) {
      this.handlers.onResult(tool.onPointerUp(this.lastToolInfo, this.handlers.context))
    }
    this.capturing = false
    this.pendingCaptureId = null
    this.toolPointerId = null
  }

  private attachWheel(): void {
    const onWheel = (event: WheelEvent): void => this.handlers.onWheel(event)
    this.overlay.addEventListener('wheel', onWheel, { passive: false })
    this.cleanups.push(() => this.overlay.removeEventListener('wheel', onWheel))
  }

  private attachDoubleClick(): void {
    const onDoubleClick = (event: MouseEvent): void => {
      if (this.readOnly) return
      const tool = this.handlers.getActiveTool()
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      if (!tool.onDoubleClick) return
      this.handlers.onResult(tool.onDoubleClick(info, this.handlers.context))
    }
    this.overlay.addEventListener('dblclick', onDoubleClick)
    this.cleanups.push(() => this.overlay.removeEventListener('dblclick', onDoubleClick))
  }

  private attachContextMenu(): void {
    const onContextMenu = (event: MouseEvent): void => {
      if (this.readOnly) return
      const tool = this.handlers.getActiveTool()
      if (!tool.onContextMenu) return
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      const result = tool.onContextMenu(info, this.handlers.context)
      if (result) event.preventDefault()
      if (typeof result === 'object') this.handlers.onResult(result)
    }
    this.overlay.addEventListener('contextmenu', onContextMenu)
    this.cleanups.push(() => this.overlay.removeEventListener('contextmenu', onContextMenu))
  }

  private attachKeyboard(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (this.readOnly) return
      const tool = this.handlers.getActiveTool()
      if (!tool.onKeyDown) return
      this.handlers.onResult(tool.onKeyDown(event, this.handlers.context))
    }
    window.addEventListener('keydown', onKeyDown)
    this.cleanups.push(() => window.removeEventListener('keydown', onKeyDown))
  }

  private localPoint(clientX: number, clientY: number): Point {
    const rect = this.overlay.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }
}
