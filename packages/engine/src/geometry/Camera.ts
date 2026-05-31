import type { Rect } from './rect.js'
import type { Vec } from './vec.js'

export interface CameraState {
  x: number
  y: number
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export class Camera {
  x: number
  y: number
  zoom: number

  constructor(state: CameraState = { x: 0, y: 0, zoom: 1 }) {
    this.x = state.x
    this.y = state.y
    this.zoom = clampZoom(state.zoom)
  }

  get state(): CameraState {
    return { x: this.x, y: this.y, zoom: this.zoom }
  }

  setState(state: CameraState): void {
    this.x = state.x
    this.y = state.y
    this.zoom = clampZoom(state.zoom)
  }

  worldToScreen(world: Vec): Vec {
    return {
      x: (world.x - this.x) * this.zoom,
      y: (world.y - this.y) * this.zoom,
    }
  }

  screenToWorld(screen: Vec): Vec {
    return {
      x: screen.x / this.zoom + this.x,
      y: screen.y / this.zoom + this.y,
    }
  }

  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.zoom
    this.y -= dy / this.zoom
  }

  zoomToScreenPoint(nextZoom: number, screen: Vec): void {
    const clamped = clampZoom(nextZoom)
    const before = this.screenToWorld(screen)
    this.zoom = clamped
    const after = this.screenToWorld(screen)
    this.x += before.x - after.x
    this.y += before.y - after.y
  }

  viewportWorldRect(screenWidth: number, screenHeight: number): Rect {
    const topLeft = this.screenToWorld({ x: 0, y: 0 })
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: screenWidth / this.zoom,
      height: screenHeight / this.zoom,
    }
  }
}
