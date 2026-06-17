import type { Camera } from '../../geometry/camera.js'
import { shapeAnchors } from '../../geometry/snap.js'
import { elementCenter } from '../../geometry/hit-test.js'
import type { Element, Point } from '../../model/types.js'

const ACCENT = '#4f6bff'
const PORT_FILL = 'rgba(79, 107, 255, 0.16)'
export const PORT_OFFSET = 16
const PORT_RADIUS = 5

const PORT_HIT_RADIUS = 8
const PORT_HOVER_RADIUS = 12

interface ShapePortHandle {
  anchor: Point
  position: Point
}

export function shapePortsWorld(element: Element): Point[] {
  return shapeAnchors(element).slice(0, 4)
}

export function shapePortHandlesScreen(element: Element, camera: Camera): ShapePortHandle[] {
  const center = elementCenter(element)
  return shapePortsWorld(element).map((anchor, index) => {
    const normal = portNormal(anchor, center, index)
    const position = camera.worldToScreen(anchor)
    return {
      anchor,
      position: {
        x: position.x + normal.x * PORT_OFFSET,
        y: position.y + normal.y * PORT_OFFSET,
      },
    }
  })
}

export function portHandleWorld(element: Element, port: Point, camera: Camera): Point {
  const handle = shapePortHandlesScreen(element, camera).find((candidate) => samePoint(candidate.anchor, port))
  return handle ? camera.screenToWorld(handle.position) : port
}

export function portAtScreen(
  screen: Point,
  element: Element,
  camera: Camera,
): Point | null {
  let best: { anchor: Point; distance: number } | null = null
  for (const handle of shapePortHandlesScreen(element, camera)) {
    const distance = Math.hypot(handle.position.x - screen.x, handle.position.y - screen.y)
    if (distance > PORT_HIT_RADIUS) continue
    if (!best || distance < best.distance) best = { anchor: handle.anchor, distance }
  }
  return best?.anchor ?? null
}

export function portHoverAtScreen(
  screen: Point,
  element: Element,
  camera: Camera,
): Point | null {
  let best: { anchor: Point; distance: number } | null = null
  for (const handle of shapePortHandlesScreen(element, camera)) {
    const anchor = camera.worldToScreen(handle.anchor)
    const distance = distanceToSegment(screen, anchor, handle.position)
    if (distance > PORT_HOVER_RADIUS) continue
    if (!best || distance < best.distance) best = { anchor: handle.anchor, distance }
  }
  return best?.anchor ?? null
}

export function paintPorts(ctx: CanvasRenderingContext2D, element: Element, camera: Camera): void {
  ctx.save()
  ctx.fillStyle = PORT_FILL
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 1.5
  for (const handle of shapePortHandlesScreen(element, camera)) {
    ctx.beginPath()
    ctx.arc(handle.position.x, handle.position.y, PORT_RADIUS, 0, Math.PI * 2)
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
  for (const handle of shapePortHandlesScreen(element, camera)) {
    ctx.beginPath()
    ctx.arc(handle.position.x, handle.position.y, PORT_RADIUS + 1, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function portNormal(anchor: Point, center: Point, index: number): Point {
  const dx = anchor.x - center.x
  const dy = anchor.y - center.y
  const length = Math.hypot(dx, dy)
  if (length > 0) return { x: dx / length, y: dy / length }
  return fallbackNormal(index)
}

function fallbackNormal(index: number): Point {
  if (index === 0) return { x: 0, y: -1 }
  if (index === 1) return { x: 1, y: 0 }
  if (index === 2) return { x: 0, y: 1 }
  return { x: -1, y: 0 }
}

function samePoint(a: Point, b: Point): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.0001
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y)
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}
