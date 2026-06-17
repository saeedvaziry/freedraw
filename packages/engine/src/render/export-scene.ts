import { contentBounds } from '../geometry/fit.js'
import type { Rect } from '../geometry/rect.js'
import type { Element, SceneSnapshot } from '../model/types.js'
import { invertColor, invertingContext } from './invert.js'
import { paintElement } from './painters/index.js'

export type ExportFormat = 'png' | 'jpg'

export interface ExportOptions {
  format: ExportFormat
  scale?: number
  padding?: number
  background?: string | null
  dark?: boolean
  quality?: number
}

export const EXPORT_DEFAULT_PADDING = 16
export const EXPORT_DEFAULT_SCALE = 2
export const EXPORT_JPG_QUALITY = 0.92

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
}

export function exportImageAssetIds(snapshot: SceneSnapshot): string[] {
  const ids = new Set<string>()
  for (const id of snapshot.order) {
    const element = snapshot.elements[id]
    if (element?.type === 'image') ids.add(element.assetId)
  }
  return [...ids]
}

export interface ExportCanvasSize {
  width: number
  height: number
}

export function exportCanvasSize(bounds: Rect, padding: number, scale: number): ExportCanvasSize {
  return {
    width: Math.max(1, Math.ceil((bounds.width + padding * 2) * scale)),
    height: Math.max(1, Math.ceil((bounds.height + padding * 2) * scale)),
  }
}

export function renderSceneToCanvas(snapshot: SceneSnapshot, options: ExportOptions): HTMLCanvasElement | null {
  const bounds = contentBounds(snapshot)
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null

  const padding = options.padding ?? EXPORT_DEFAULT_PADDING
  const scale = options.scale ?? EXPORT_DEFAULT_SCALE
  const { width, height } = exportCanvasSize(bounds, padding, scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (options.background) {
    ctx.fillStyle = options.dark ? invertColor(options.background) : options.background
    ctx.fillRect(0, 0, width, height)
  }

  const paintCtx = options.dark ? invertingContext(ctx) : ctx
  ctx.setTransform(scale, 0, 0, scale, (-bounds.x + padding) * scale, (-bounds.y + padding) * scale)
  for (const id of snapshot.order) {
    const element: Element | undefined = snapshot.elements[id]
    if (element) paintElement(paintCtx, element)
  }
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, options: ExportOptions): Promise<Blob | null> {
  const quality = options.format === 'jpg' ? options.quality ?? EXPORT_JPG_QUALITY : undefined
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), MIME[options.format], quality)
  })
}
