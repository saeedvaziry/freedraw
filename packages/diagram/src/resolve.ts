import { resolveArrowPoints } from '@freedraw/engine/connectors'
import { pointsBounds } from '@freedraw/engine/model/factory'
import type { Element, ElementId } from '@freedraw/engine/model/types'

function isArrow(element: Element): element is Extract<Element, { type: 'arrow' | 'line' }> {
  return element.type === 'arrow' || element.type === 'line'
}

export function resolveDiagramArrows(elements: Element[]): Element[] {
  const record: Record<ElementId, Element> = {}
  for (const element of elements) record[element.id] = element

  for (const element of elements) {
    if (!isArrow(element)) continue
    const route = resolveArrowPoints(element, record)
    if (route.length < 2) continue
    element.route = route
    const bounds = pointsBounds(route)
    element.x = bounds.x
    element.y = bounds.y
    element.width = bounds.width
    element.height = bounds.height
  }

  return elements
}
