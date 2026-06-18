import type { Camera } from '../../geometry/camera.js'
import type { SnapGuide } from '../../geometry/snap.js'
import type { Point } from '../../model/types.js'

const GUIDE_COLOR = '#f04bb5'
const CAP_SIZE = 4

export function paintGuides(ctx: CanvasRenderingContext2D, guides: SnapGuide[], camera: Camera): void {
  if (guides.length === 0) return
  ctx.save()
  ctx.strokeStyle = GUIDE_COLOR
  ctx.fillStyle = GUIDE_COLOR
  ctx.lineWidth = 1
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const guide of guides) {
    if (guide.kind === 'line') {
      strokeSegment(ctx, camera.worldToScreen(guide.from), camera.worldToScreen(guide.to), [4, 4])
      continue
    }
    if (guide.kind === 'align') {
      strokeSegment(ctx, camera.worldToScreen(guide.from), camera.worldToScreen(guide.to), [])
      continue
    }
    if (guide.kind === 'distance') {
      paintDistance(ctx, camera.worldToScreen(guide.from), camera.worldToScreen(guide.to), guide.label)
      continue
    }
    const at = camera.worldToScreen(guide.at)
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(at.x, at.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function strokeSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point, dash: number[]): void {
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

function paintDistance(ctx: CanvasRenderingContext2D, from: Point, to: Point, label: number): void {
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
  strokeSegment(ctx, from, to, [])
  ctx.setLineDash([])
  for (const point of [from, to]) {
    ctx.beginPath()
    if (horizontal) {
      ctx.moveTo(point.x, point.y - CAP_SIZE)
      ctx.lineTo(point.x, point.y + CAP_SIZE)
    } else {
      ctx.moveTo(point.x - CAP_SIZE, point.y)
      ctx.lineTo(point.x + CAP_SIZE, point.y)
    }
    ctx.stroke()
  }
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const text = String(Math.round(label))
  const width = ctx.measureText(text).width
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(mid.x - width / 2 - 2, mid.y - 7, width + 4, 14)
  ctx.fillStyle = GUIDE_COLOR
  ctx.fillText(text, mid.x, mid.y)
}
