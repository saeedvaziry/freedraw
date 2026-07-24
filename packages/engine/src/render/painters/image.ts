import type { ImageCache } from '../../assets/image-cache.js'
import type { Element, ImageElement } from '../../model/types.js'
import { getOutline, traceOutline } from '../../geometry/shape-outline.js'
import type { DrawTarget } from '../draw-target.js'
import { invertColor } from '../invert.js'

const PLACEHOLDER_FILL = '#e5e7eb'
const PLACEHOLDER_STROKE = '#cbd5e1'
const PLACEHOLDER_FILL_DARK = invertColor(PLACEHOLDER_FILL)
const PLACEHOLDER_STROKE_DARK = invertColor(PLACEHOLDER_STROKE)

let imageCache: ImageCache | null = null

export function setImageCache(cache: ImageCache | null): void {
  imageCache = cache
}

export function paintImage(ctx: DrawTarget, element: Element, dark: boolean): void {
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
  const fill = dark ? PLACEHOLDER_FILL_DARK : PLACEHOLDER_FILL
  const stroke = dark ? PLACEHOLDER_STROKE_DARK : PLACEHOLDER_STROKE
  if (outline && image.style.roundness > 0) {
    ctx.beginPath()
    traceOutline(ctx, outline)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
    return
  }
  ctx.fillStyle = fill
  ctx.fillRect(image.x, image.y, image.width, image.height)
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  ctx.strokeRect(image.x, image.y, image.width, image.height)
  ctx.restore()
}
