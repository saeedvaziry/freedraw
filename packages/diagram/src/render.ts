import {
  renderSceneToCanvas,
  canvasToBlob,
  EXPORT_DEFAULT_SCALE,
  type ExportFormat,
} from '@freedraw/engine/render/exportScene'
import type { Direction } from '@freedraw/engine/diagram'
import type { Style } from '@freedraw/engine/model/types'
import { buildScene, type BuildSceneOptions, type DiagramScene } from './scene.js'

export interface RenderOptions {
  scale?: number
  padding?: number
  background?: string | null
  dark?: boolean
  format?: ExportFormat
  quality?: number
  direction?: Direction
  style?: Partial<Style>
}

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
}

function toScene(input: string | DiagramScene, options: RenderOptions): DiagramScene {
  if (typeof input !== 'string') return input
  const buildOptions: BuildSceneOptions = { direction: options.direction, style: options.style }
  return buildScene(input, buildOptions)
}

function toCanvas(input: string | DiagramScene, options: RenderOptions): HTMLCanvasElement | null {
  const scene = toScene(input, options)
  return renderSceneToCanvas(scene.snapshot, {
    format: options.format ?? 'png',
    scale: options.scale,
    padding: options.padding,
    background: options.background,
    dark: options.dark,
    quality: options.quality,
  })
}

export function renderToCanvas(input: string | DiagramScene, options: RenderOptions = {}): HTMLCanvasElement | null {
  return toCanvas(input, options)
}

export function renderToDataURL(input: string | DiagramScene, options: RenderOptions = {}): string | null {
  const canvas = toCanvas(input, options)
  if (!canvas) return null
  const format = options.format ?? 'png'
  return canvas.toDataURL(MIME[format], options.quality)
}

export function renderToBlob(input: string | DiagramScene, options: RenderOptions = {}): Promise<Blob | null> {
  const canvas = toCanvas(input, options)
  if (!canvas) return Promise.resolve(null)
  return canvasToBlob(canvas, { format: options.format ?? 'png', quality: options.quality })
}

export function mount(
  container: HTMLElement,
  input: string | DiagramScene,
  options: RenderOptions = {},
): HTMLCanvasElement | null {
  const canvas = toCanvas(input, options)
  if (!canvas) return null
  const scale = options.scale ?? EXPORT_DEFAULT_SCALE
  canvas.style.width = `${canvas.width / scale}px`
  canvas.style.height = `${canvas.height / scale}px`
  container.appendChild(canvas)
  return canvas
}
