import type { Camera } from '../../geometry/camera.js'
import { arrowRoute } from '../../connectors/resolve.js'
import { editableRouteSegments, type RouteSegmentAxis } from '../../geometry/arrow-geometry.js'
import type { ArrowElement, Point } from '../../model/types.js'

const ACCENT = '#4f6bff'
const ENDPOINT_SIZE = 9
const MIDPOINT_WIDTH = 8
const MIDPOINT_HEIGHT = 16

export type ArrowHandleId = 'start' | 'end' | 'midpoint'

interface EndpointArrowHandle {
  id: 'start' | 'end'
  position: Point
}

interface SegmentArrowHandle {
  id: 'midpoint'
  position: Point
  segmentIndex: number
  axis: RouteSegmentAxis
}

export type ArrowHandle = EndpointArrowHandle | SegmentArrowHandle

export function arrowHandlesScreen(arrow: ArrowElement, camera: Camera): ArrowHandle[] {
  const route = arrowRoute(arrow)
  if (route.length < 2) return []
  const handles: ArrowHandle[] = [
    { id: 'start', position: camera.worldToScreen(route[0]!) },
    { id: 'end', position: camera.worldToScreen(route[route.length - 1]!) },
  ]
  for (const segment of editableRouteSegments(route)) {
    handles.push({
      id: 'midpoint',
      segmentIndex: segment.index,
      axis: segment.axis,
      position: camera.worldToScreen(segment.midpoint),
    })
  }
  return handles
}

const HANDLE_HIT_RADIUS = 9

export function arrowHandleAtScreen(
  screen: Point,
  arrow: ArrowElement,
  camera: Camera,
): ArrowHandle | null {
  let best: ArrowHandle | null = null
  let bestDist = HANDLE_HIT_RADIUS
  for (const handle of arrowHandlesScreen(arrow, camera)) {
    const dist = Math.hypot(handle.position.x - screen.x, handle.position.y - screen.y)
    if (dist <= bestDist) {
      bestDist = dist
      best = handle
    }
  }
  return best
}

export function paintArrowHandles(
  ctx: CanvasRenderingContext2D,
  arrow: ArrowElement,
  camera: Camera,
): void {
  const points = arrowRoute(arrow)
  if (points.length < 2) return
  ctx.save()
  ctx.strokeStyle = ACCENT
  ctx.lineWidth = 1.5

  ctx.beginPath()
  points.forEach((point, index) => {
    const screen = camera.worldToScreen(point)
    if (index === 0) ctx.moveTo(screen.x, screen.y)
    else ctx.lineTo(screen.x, screen.y)
  })
  ctx.stroke()

  for (const handle of arrowHandlesScreen(arrow, camera)) {
    if (handle.id === 'midpoint') {
      ctx.fillStyle = '#ffffff'
      drawPill(ctx, handle.position)
      continue
    }
    const bound = handle.id === 'start' ? Boolean(arrow.start) : Boolean(arrow.end)
    ctx.fillStyle = bound ? ACCENT : '#ffffff'
    drawSquare(ctx, handle.position)
  }
  ctx.restore()
}

function drawSquare(ctx: CanvasRenderingContext2D, position: Point): void {
  const half = ENDPOINT_SIZE / 2
  ctx.beginPath()
  ctx.rect(position.x - half, position.y - half, ENDPOINT_SIZE, ENDPOINT_SIZE)
  ctx.fill()
  ctx.stroke()
}

function drawPill(ctx: CanvasRenderingContext2D, position: Point): void {
  const w = MIDPOINT_WIDTH / 2
  const h = MIDPOINT_HEIGHT / 2
  ctx.beginPath()
  ctx.moveTo(position.x - w, position.y - h + w)
  ctx.arc(position.x, position.y - h + w, w, Math.PI, 0)
  ctx.lineTo(position.x + w, position.y + h - w)
  ctx.arc(position.x, position.y + h - w, w, 0, Math.PI)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}
