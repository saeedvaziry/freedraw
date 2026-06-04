import type { Camera } from '../../geometry/Camera.js'
import type { SnapGuide } from '../../geometry/snap.js'

const GUIDE_COLOR = '#f04bb5'
const TICK = 3
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
      ctx.setLineDash([])
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
  const distance = Math.round(Math.hypot(guide.to.x - guide.from.x, guide.to.y - guide.from.y))
  if (distance <= 0) return
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)

  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  if (horizontal) {
    tickVertical(ctx, from.x, from.y)
    tickVertical(ctx, to.x, to.y)
  } else {
    tickHorizontal(ctx, from.x, from.y)
    tickHorizontal(ctx, to.x, to.y)
  }
  ctx.stroke()
  paintLabel(ctx, String(distance), (from.x + to.x) / 2, (from.y + to.y) / 2, horizontal)
}

function tickVertical(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.moveTo(x, y - TICK)
  ctx.lineTo(x, y + TICK)
}

function tickHorizontal(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.moveTo(x - TICK, y)
  ctx.lineTo(x + TICK, y)
}

function paintLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  horizontal: boolean,
): void {
  ctx.font = LABEL_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const x = horizontal ? cx : cx + 10
  const y = horizontal ? cy - 8 : cy
  const width = ctx.measureText(label).width + 6
  ctx.fillStyle = GUIDE_COLOR
  ctx.fillRect(x - width / 2, y - 7, width, 14)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, x, y)
}
