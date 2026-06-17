import type { ImageCache } from '../../assets/image-cache.js'
import type { Element, ImageElement } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shape-outline.js'

const PLACEHOLDER_FILL = '#e5e7eb'
const PLACEHOLDER_STROKE = '#cbd5e1'

let imageCache: ImageCache | null = null

export function setImageCache(cache: ImageCache | null): void {
  imageCache = cache
}

export function paintImage(ctx: CanvasRenderingContext2D, element: Element): void {
  const image = element as ImageElement
  const bitmap = imageCache?.getBitmap(image.assetId)

  ctx.save()
  ctx.globalAlpha = element.style.opacity
  const outline = getOutline('roundRect', image, image.style.roundness)
  if (bitmap) {
    if (outline && image.style.roundness > 0) {
      ctx.beginPath()
      traceOutline(ctx, outline)
      ctx.clip()
    }
    ctx.drawImage(bitmap, image.x, image.y, image.width, image.height)
    ctx.restore()
    return
  }
  if (outline && image.style.roundness > 0) {
    ctx.beginPath()
    traceOutline(ctx, outline)
    ctx.fillStyle = PLACEHOLDER_FILL
    ctx.fill()
    ctx.strokeStyle = PLACEHOLDER_STROKE
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
    return
  }
  ctx.fillStyle = PLACEHOLDER_FILL
  ctx.fillRect(image.x, image.y, image.width, image.height)
  ctx.strokeStyle = PLACEHOLDER_STROKE
  ctx.lineWidth = 1
  ctx.strokeRect(image.x, image.y, image.width, image.height)
  ctx.restore()
}
