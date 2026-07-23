import { createId } from '../model/factory.js'
import { createSceneClipboard } from './clipboard.js'
import type { SceneClipboardPayload } from './clipboard.js'
import type { ElementId, SceneSnapshot } from '../model/types.js'

export const STENCIL_VERSION = 1

export type StencilKind = 'stencil' | 'template'

export interface Stencil {
  version: typeof STENCIL_VERSION
  id: string
  kind: StencilKind
  name: string
  payload: SceneClipboardPayload
}

export type Template = Stencil & { kind: 'template' }

export interface BuildStencilOptions {
  name?: string
  kind?: StencilKind
}

export function buildStencil(
  snapshot: SceneSnapshot,
  ids: Iterable<ElementId>,
  options: BuildStencilOptions = {},
): Stencil | null {
  const payload = createSceneClipboard(snapshot, ids)
  if (!payload) return null
  return {
    version: STENCIL_VERSION,
    id: createId(),
    kind: options.kind ?? 'stencil',
    name: options.name ?? '',
    payload,
  }
}
