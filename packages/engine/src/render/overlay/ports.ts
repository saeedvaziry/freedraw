import type { Camera } from '../../geometry/Camera.js'
import { shapeAnchors } from '../../geometry/snap.js'
import type { Element, Point } from '../../model/types.js'

const ACCENT = '#4f6bff'
const PORT_RADIUS = 5

const PORT_HIT_RADIUS = 8

export function shapePortsWorld(element: Element): Point[] {
  return shapeAnchors(element).slice(0, 4)
}

export function portAtScreen(
  screen: Point,
  element: Element,
  camera: Camera,
): Point | null {
  for (const port of shapePortsWorld(element)) {
    const at = camera.worldToScreen(port)
    if (Math.hypot(at.x - screen.x, at.y - screen.y) <= PORT_HIT_RADIUS) return port
  }
  return null
}

export function paintPorts(ctx: CanvasRenderingContext2D, element: Element, camera: Camera): void {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 1.5
  for (const port of shapePortsWorld(element)) {
    const screen = camera.worldToScreen(port)
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, PORT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

export function paintTargetHighlight(
  ctx: CanvasRenderingContext2D,
  element: Element,
  camera: Camera,
): void {
  ctx.save()
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 2
  for (const port of shapePortsWorld(element)) {
    const screen = camera.worldToScreen(port)
    ctx.beginPath()
    ctx.arc(screen.x, screen.y, PORT_RADIUS + 1, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}
