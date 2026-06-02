import type { Camera } from '../geometry/Camera.js'
import type { Point } from '../model/types.js'
import type { PointerInfo, Tool, ToolContext, ToolResult } from '../tools/Tool.js'

export interface InputHandlers {
  getActiveTool(): Tool
  context: ToolContext
  onResult(result: ToolResult | void): void
  onWheel(event: WheelEvent): void
  onPointerInfo?(info: PointerInfo): void
}

type Cleanup = () => void

export class InputManager {
  private readonly cleanups: Cleanup[] = []
  private capturing = false
  private pendingCaptureId: number | null = null

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
      const tool = this.handlers.getActiveTool()
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      if (!tool.onPointerDown) return
      this.pendingCaptureId = event.pointerId
      this.handlers.onResult(tool.onPointerDown(info, this.handlers.context))
    }
    const onMove = (event: PointerEvent): void => {
      const tool = this.handlers.getActiveTool()
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      if (!tool.onPointerMove) return
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
      const tool = this.handlers.getActiveTool()
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      if (this.capturing && this.overlay.hasPointerCapture(event.pointerId)) {
        this.overlay.releasePointerCapture(event.pointerId)
      }
      this.capturing = false
      this.pendingCaptureId = null
      if (!tool.onPointerUp) return
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

  private attachWheel(): void {
    const onWheel = (event: WheelEvent): void => this.handlers.onWheel(event)
    this.overlay.addEventListener('wheel', onWheel, { passive: false })
    this.cleanups.push(() => this.overlay.removeEventListener('wheel', onWheel))
  }

  private attachDoubleClick(): void {
    const onDoubleClick = (event: MouseEvent): void => {
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
      const tool = this.handlers.getActiveTool()
      if (!tool.onContextMenu) return
      const info = this.info(event)
      this.handlers.onPointerInfo?.(info)
      if (tool.onContextMenu(info, this.handlers.context)) event.preventDefault()
    }
    this.overlay.addEventListener('contextmenu', onContextMenu)
    this.cleanups.push(() => this.overlay.removeEventListener('contextmenu', onContextMenu))
  }

  private attachKeyboard(): void {
    const onKeyDown = (event: KeyboardEvent): void => {
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
