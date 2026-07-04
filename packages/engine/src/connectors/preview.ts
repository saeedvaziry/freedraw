import { pointsBounds } from '../model/factory.js'
import type { ArrowElement, Element, ElementId, SceneSnapshot } from '../model/types.js'
import { resolveArrowPoints } from './router/index.js'

export function previewArrow(
  arrow: ArrowElement,
  snapshot: SceneSnapshot,
  extraElements: Record<ElementId, Element> = {},
): ArrowElement {
  const elements = { ...snapshot.elements, ...extraElements, [arrow.id]: arrow }
  const route = resolveArrowPoints(arrow, elements)
  return { ...arrow, ...pointsBounds(route), route }
}
