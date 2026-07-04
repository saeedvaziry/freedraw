import type { ArrowElement, Binding, Element, Point } from '../model/types.js'
import { createBinding } from './binding.js'

export type ArrowEnd = 'start' | 'end'

export interface EndpointSnap {
  point: Point
  target: Element | null
}

export function createEndpointBinding(target: Element, point: Point, approachPoint: Point, gap = 0): Binding {
  return createBinding(target, point, gap, approachPoint)
}

export function rebindEnd(
  arrow: ArrowElement,
  which: ArrowEnd,
  snap: EndpointSnap,
  approachPoint: Point,
  gap = 0,
): Binding | null {
  if (!snap.target) return null
  const other = which === 'start' ? arrow.end : arrow.start
  if (other?.elementId === snap.target.id) return null
  return createEndpointBinding(snap.target, snap.point, approachPoint, gap)
}

export function routingForBindings(
  arrow: ArrowElement,
  bindings: { start?: Binding | null; end?: Binding | null },
): ArrowElement['routing'] {
  const start = 'start' in bindings ? bindings.start ?? undefined : arrow.start
  const end = 'end' in bindings ? bindings.end ?? undefined : arrow.end
  return start || end ? 'orthogonal' : arrow.routing
}
