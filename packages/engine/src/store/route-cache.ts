import { resolveArrowPoints } from '../connectors/router/index.js'
import { intersects, type Rect } from '../geometry/rect.js'
import { rotatedBounds } from '../geometry/rotate.js'
import { pointsBounds } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import type { ArrowElement, Element, ElementId, Point, SceneSnapshot } from '../model/types.js'

interface RouteEntry {
  route: Point[]
  bounds: Rect
}

export class RouteCache {
  private readonly entries = new Map<ElementId, RouteEntry>()

  get(arrow: ArrowElement, elements: Record<ElementId, Element>): RouteEntry {
    const cached = this.entries.get(arrow.id)
    if (cached) return cloneEntry(cached)

    const route = resolveArrowPoints(arrow, elements)
    const entry = { route: route.map(clonePoint), bounds: pointsBounds(route) }
    this.entries.set(arrow.id, entry)
    return cloneEntry(entry)
  }

  overlay(snapshot: SceneSnapshot): SceneSnapshot {
    const elements = { ...snapshot.elements }
    for (const id of snapshot.order) {
      const element = elements[id]
      if (!element || !isArrowElement(element)) continue
      const { route, bounds } = this.get(element, elements)
      elements[id] = { ...element, ...bounds, route }
    }
    return { ...snapshot, elements }
  }

  invalidate(ids: Iterable<ElementId>): void {
    for (const id of ids) this.entries.delete(id)
  }

  invalidateAll(): void {
    this.entries.clear()
  }

  invalidateForChanges(previous: SceneSnapshot, next: SceneSnapshot, changedIds: Iterable<ElementId>): void {
    const invalid = new Set<ElementId>()
    for (const id of changedIds) {
      const before = previous.elements[id]
      const after = next.elements[id]

      if ((before && isArrowElement(before)) || (after && isArrowElement(after))) invalid.add(id)
      if (before && !isArrowElement(before)) this.invalidateAffectedByShape(id, before, previous, next, invalid)
      if (after && !isArrowElement(after)) this.invalidateAffectedByShape(id, after, previous, next, invalid)
    }
    this.invalidate(invalid)
  }

  private invalidateAffectedByShape(
    shapeId: ElementId,
    shape: Element,
    previous: SceneSnapshot,
    next: SceneSnapshot,
    invalid: Set<ElementId>,
  ): void {
    for (const element of Object.values(previous.elements)) {
      if (isArrowElement(element) && isBoundTo(element, shapeId)) invalid.add(element.id)
    }
    for (const element of Object.values(next.elements)) {
      if (isArrowElement(element) && isBoundTo(element, shapeId)) invalid.add(element.id)
    }

    const shapeBounds = rotatedBounds(shape)
    for (const [arrowId, entry] of this.entries) {
      if (intersects(entry.bounds, shapeBounds)) invalid.add(arrowId)
    }
  }
}

function isBoundTo(arrow: ArrowElement, elementId: ElementId): boolean {
  return arrow.start?.elementId === elementId || arrow.end?.elementId === elementId
}

function cloneEntry(entry: RouteEntry): RouteEntry {
  return {
    route: entry.route.map(clonePoint),
    bounds: { ...entry.bounds },
  }
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y }
}
