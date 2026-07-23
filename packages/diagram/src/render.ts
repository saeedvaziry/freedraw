import {
  renderSceneExport,
  canvasToBlob,
  exportTooLarge,
  EXPORT_DEFAULT_SCALE,
  type ExportFailure,
  type ExportFormat,
  type ExportRenderResult,
} from '@freedraw/engine/render/exportScene'
import type { DiagramError, Direction, LayoutOptions } from '@freedraw/engine/diagram'
import type { Style } from '@freedraw/engine/model/types'
import { buildScene, type BuildSceneOptions, type DiagramScene } from './scene.js'

export interface RenderParseFailure {
  ok: false
  reason: 'parse-error'
  errors: DiagramError[]
}

export type RenderFailure = ExportFailure | RenderParseFailure

export interface RenderOptions {
  scale?: number
  padding?: number
  background?: string | null
  dark?: boolean
  format?: ExportFormat
  quality?: number
  onFailure?: (failure: RenderFailure) => void
}

export interface RenderFromCodeOptions extends RenderOptions {
  direction?: Direction
  style?: Partial<Style>
  layout?: LayoutOptions
}

type Input = string | DiagramScene
type OptionsFor<T extends Input> = T extends string ? RenderFromCodeOptions : RenderOptions
type RenderResult = ExportRenderResult | RenderParseFailure

const MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
}

function toScene(input: Input, options: RenderFromCodeOptions): DiagramScene {
  if (typeof input !== 'string') return input
  const buildOptions: BuildSceneOptions = { direction: options.direction, style: options.style, layout: options.layout }
  return buildScene(input, buildOptions)
}

function toCanvas(input: Input, options: RenderFromCodeOptions): RenderResult {
  const scene = toScene(input, options)
  const rendered = renderSceneExport(scene.snapshot, {
    format: options.format ?? 'png',
    scale: options.scale,
    padding: options.padding,
    background: options.background,
    dark: options.dark,
    quality: options.quality,
  })
  const result: RenderResult =
    !rendered.ok && rendered.reason === 'empty' && scene.errors.length > 0
      ? { ok: false, reason: 'parse-error', errors: scene.errors }
      : rendered
  if (!result.ok) options.onFailure?.(result)
  return result
}

export function renderToCanvas<T extends Input>(input: T, options: OptionsFor<T> = {} as OptionsFor<T>): HTMLCanvasElement | null {
  const result = toCanvas(input, options)
  return result.ok ? result.canvas : null
}

export function renderToDataURL<T extends Input>(input: T, options: OptionsFor<T> = {} as OptionsFor<T>): string | null {
  const result = toCanvas(input, options)
  if (!result.ok) return null
  const format = options.format ?? 'png'
  return result.canvas.toDataURL(MIME[format], options.quality)
}

export async function renderToBlob<T extends Input>(input: T, options: OptionsFor<T> = {} as OptionsFor<T>): Promise<Blob | null> {
  const result = toCanvas(input, options)
  if (!result.ok) return null
  const blob = await canvasToBlob(result.canvas, { format: options.format ?? 'png', quality: options.quality })
  if (!blob) options.onFailure?.(exportTooLarge(result.size))
  return blob
}

export function mount<T extends Input>(
  container: HTMLElement,
  input: T,
  options: OptionsFor<T> = {} as OptionsFor<T>,
): HTMLCanvasElement | null {
  const result = toCanvas(input, options)
  if (!result.ok) return null
  const scale = options.scale ?? EXPORT_DEFAULT_SCALE
  const canvas = result.canvas
  canvas.style.width = `${canvas.width / scale}px`
  canvas.style.height = `${canvas.height / scale}px`
  container.appendChild(canvas)
  return canvas
}
