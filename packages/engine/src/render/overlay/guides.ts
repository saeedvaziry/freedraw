import type { Camera } from '../../geometry/Camera.js'
import type { SnapGuide } from '../../geometry/snap.js'

const GUIDE_COLOR = '#f04bb5'

export function paintGuides(ctx: CanvasRenderingContext2D, guides: SnapGuide[], camera: Camera): void {
  if (guides.length === 0) return
  ctx.save()
  ctx.strokeStyle = GUIDE_COLOR
  ctx.fillStyle = GUIDE_COLOR
  ctx.lineWidth = 1
  for (const guide of guides) {
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
