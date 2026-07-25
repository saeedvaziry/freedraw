import { useCallback, useMemo } from 'react'
import {
  builtinStencils,
  builtinTemplates,
  type EditorController,
  type SceneStore,
  type Stencil,
} from '@freedraw/engine'
import { useStencilLibrary } from './use-stencil-library.js'

export const STENCIL_DRAG_MIME = 'application/x-freedraw-stencil'

export interface StencilDropApi {
  onDragOver(event: React.DragEvent): boolean
  onDrop(event: React.DragEvent): boolean
}

export function buildStencilIndex(userStencils: Stencil[]): Map<string, Stencil> {
  const map = new Map<string, Stencil>()
  for (const template of builtinTemplates) map.set(template.id, template)
  for (const stencil of builtinStencils) map.set(stencil.id, stencil)
  for (const stencil of userStencils) map.set(stencil.id, stencil)
  return map
}

function carriesStencil(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(STENCIL_DRAG_MIME)
}

export function useStencilDrop(
  controller: EditorController | null,
  store: SceneStore,
  enabled: boolean,
): StencilDropApi {
  const { stencils } = useStencilLibrary()

  const byId = useMemo(() => buildStencilIndex(stencils), [stencils])

  const onDragOver = useCallback(
    (event: React.DragEvent): boolean => {
      if (!enabled || !carriesStencil(event)) return false
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      return true
    },
    [enabled],
  )

  const onDrop = useCallback(
    (event: React.DragEvent): boolean => {
      if (!enabled || !controller || !carriesStencil(event)) return false
      event.preventDefault()
      const stencil = byId.get(event.dataTransfer.getData(STENCIL_DRAG_MIME))
      if (!stencil) return true
      const rect = event.currentTarget.getBoundingClientRect()
      const world = controller.screenToWorld({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
      store.insertStencil(stencil, world)
      return true
    },
    [enabled, controller, store, byId],
  )

  return useMemo(() => ({ onDragOver, onDrop }), [onDragOver, onDrop])
}
