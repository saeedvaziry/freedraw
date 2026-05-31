import { clampZoom, type CameraState } from './Camera.js'
import { elementBounds } from './hitTest.js'
import type { Rect } from './rect.js'
import type { Element, ElementId, SceneSnapshot } from '../model/types.js'

export const FIT_PADDING = 64

export function contentBounds(snapshot: SceneSnapshot): Rect | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const ids: ElementId[] = snapshot.order.length > 0 ? snapshot.order : Object.keys(snapshot.elements)
  for (const id of ids) {
    const element: Element | undefined = snapshot.elements[id]
    if (!element) continue
    const bounds = elementBounds(element)
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function fitCamera(
  bounds: Rect,
  viewportWidth: number,
  viewportHeight: number,
  padding = FIT_PADDING,
): CameraState {
  const availableWidth = Math.max(1, viewportWidth - padding * 2)
  const availableHeight = Math.max(1, viewportHeight - padding * 2)
  const width = Math.max(1, bounds.width)
  const height = Math.max(1, bounds.height)
  const zoom = clampZoom(Math.min(availableWidth / width, availableHeight / height))
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  return {
    zoom,
    x: centerX - viewportWidth / 2 / zoom,
    y: centerY - viewportHeight / 2 / zoom,
  }
}
