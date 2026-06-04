import type { Camera } from '../../geometry/Camera.js'
import type { SnapGuide } from '../../geometry/snap.js'

const GUIDE_COLOR = '#f04bb5'
const CAP_LENGTH = 4
const LABEL_FONT = '11px ui-sans-serif, system-ui, sans-serif'

export function paintGuides(ctx: CanvasRenderingContext2D, guides: SnapGuide[], camera: Camera): void {
  if (guides.length === 0) return
  ctx.save()
  ctx.strokeStyle = GUIDE_COLOR
  ctx.fillStyle = GUIDE_COLOR
  ctx.lineWidth = 1
  for (const guide of guides) {
    if (guide.kind === 'distance') {
      paintDistance(ctx, guide, camera)
      continue
    }
    if (guide.kind === 'line') {
      const from = camera.worldToScreen(guide.from)
      const to = camera.worldToScreen(guide.to)
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
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

function paintDistance(
  ctx: CanvasRenderingContext2D,
  guide: Extract<SnapGuide, { kind: 'distance' }>,
  camera: Camera,
): void {
  const from = camera.worldToScreen(guide.from)
  const to = camera.worldToScreen(guide.to)
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  if (horizontal) {
    cap(ctx, from.x, from.y)
    cap(ctx, to.x, to.y)
  } else {
    capHorizontal(ctx, from.x, from.y)
    capHorizontal(ctx, to.x, to.y)
  }
  ctx.stroke()
  paintDistanceLabel(ctx, guide, from, to, horizontal)
}

function cap(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.moveTo(x, y - CAP_LENGTH)
  ctx.lineTo(x, y + CAP_LENGTH)
}

function capHorizontal(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.moveTo(x - CAP_LENGTH, y)
  ctx.lineTo(x + CAP_LENGTH, y)
}

function paintDistanceLabel(
  ctx: CanvasRenderingContext2D,
  guide: Extract<SnapGuide, { kind: 'distance' }>,
  from: { x: number; y: number },
  to: { x: number; y: number },
  horizontal: boolean,
): void {
  const distance = Math.round(Math.hypot(guide.to.x - guide.from.x, guide.to.y - guide.from.y))
  if (distance <= 0) return
  const label = String(distance)
  ctx.font = LABEL_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = (from.x + to.x) / 2
  const cy = (from.y + to.y) / 2
  const x = horizontal ? cx : cx + 10
  const y = horizontal ? cy - 8 : cy
  const width = ctx.measureText(label).width + 6
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - width / 2, y - 7, width, 14)
  ctx.fillStyle = GUIDE_COLOR
  ctx.fillText(label, x, y)
}
