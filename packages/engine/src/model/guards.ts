import type { ArrowElement, Element } from './types.js'

export function isArrowElement(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}
