import { renderSceneExport } from '../render/export-scene.js'
import type { ElementId, SceneSnapshot } from '../model/types.js'
import { buildStencil } from './stencil.js'
import type { BuildStencilOptions, Stencil } from './stencil.js'

export const STENCIL_THUMBNAIL_SCALE = 1
export const STENCIL_THUMBNAIL_PADDING = 8

export interface StencilThumbnailOptions {
  scale?: number
  padding?: number
  background?: string | null
  dark?: boolean
}

export function renderStencilThumbnail(
  snapshot: SceneSnapshot,
  ids: Iterable<ElementId>,
  options: StencilThumbnailOptions = {},
): string | null {
  const elementIds = [...ids]
  if (elementIds.length === 0) return null
  const result = renderSceneExport(snapshot, {
    format: 'png',
    elementIds,
    scale: options.scale ?? STENCIL_THUMBNAIL_SCALE,
    padding: options.padding ?? STENCIL_THUMBNAIL_PADDING,
    background: options.background ?? null,
    dark: options.dark ?? false,
  })
  if (!result.ok) return null
  return result.canvas.toDataURL('image/png')
}

export function buildStencilFromSelection(
  snapshot: SceneSnapshot,
  ids: Iterable<ElementId>,
  options: BuildStencilOptions = {},
): Stencil | null {
  const elementIds = [...ids]
  const stencil = buildStencil(snapshot, elementIds, options)
  if (!stencil) return null
  const thumbnail = renderStencilThumbnail(snapshot, elementIds)
  return thumbnail ? { ...stencil, thumbnail } : stencil
}
