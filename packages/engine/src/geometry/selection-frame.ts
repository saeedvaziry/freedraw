import type { Element } from '../model/types.js'
import { elementBounds, elementCenter, selectionBounds } from './hit-test.js'
import type { SelectionFrame } from './handles.js'

export function selectionFrameFor(elements: Element[]): SelectionFrame | null {
  if (elements.length === 0) return null
  if (elements.length === 1) {
    const element = elements[0]
    if (!element) return null
    return {
      bounds: elementBounds(element),
      rotation: element.rotation,
      center: elementCenter(element),
    }
  }
  const bounds = selectionBounds(elements)
  if (!bounds) return null
  return {
    bounds,
    rotation: 0,
    center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
  }
}
