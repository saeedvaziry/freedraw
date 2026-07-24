import { previewArrow } from '../connectors/preview.js'
import { arrowRoute } from '../connectors/resolve.js'
import { pointsBounds } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import type { Element, ElementId, Point } from '../model/types.js'
import type { SceneStore } from '../store/scene-store.js'

export function moveElementPatch(
  element: Element,
  dx: number,
  dy: number,
  movingShapeIds: ReadonlySet<ElementId>,
): Partial<Element> {
  if (isArrowElement(element)) {
    const translate = (point: Point): Point => ({ x: point.x + dx, y: point.y + dy })
    const detachStart = element.start != null && !movingShapeIds.has(element.start.elementId)
    const detachEnd = element.end != null && !movingShapeIds.has(element.end.elementId)
    const points = detachStart || detachEnd ? arrowRoute(element).map(translate) : element.points.map(translate)
    return {
      points,
      ...(detachStart ? { start: undefined } : {}),
      ...(detachEnd ? { end: undefined } : {}),
      routing: detachStart && detachEnd ? 'straight' : element.routing,
    }
  }
  if (element.type === 'freedraw') {
    const points = element.points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
    return { points, ...pointsBounds(points) }
  }
  return { x: element.x + dx, y: element.y + dy }
}

export function applyPatch(element: Element, patch: Partial<Element>): Element {
  return { ...element, ...patch } as Element
}

export function buildTransientElements(
  store: SceneStore,
  transformed: Map<ElementId, Element>,
): Element[] {
  const snapshot = store.getSnapshot()
  const shapeOverrides: Record<ElementId, Element> = {}
  for (const element of transformed.values()) {
    if (!isArrowElement(element)) shapeOverrides[element.id] = element
  }
  const boundArrowIds = new Set<ElementId>()
  for (const shapeId of Object.keys(shapeOverrides)) {
    for (const arrowId of store.arrowsForShape(shapeId)) {
      if (!transformed.has(arrowId)) boundArrowIds.add(arrowId)
    }
  }
  const result: Element[] = []
  for (const id of snapshot.order) {
    const override = transformed.get(id)
    if (override) {
      result.push(isArrowElement(override) ? previewArrow(override, snapshot, shapeOverrides) : override)
    } else if (boundArrowIds.has(id)) {
      const arrow = snapshot.elements[id]
      if (arrow && isArrowElement(arrow)) result.push(previewArrow(arrow, snapshot, shapeOverrides))
    }
  }
  return result
}
