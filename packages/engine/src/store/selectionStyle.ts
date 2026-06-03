import type { Element, Style } from '../model/types.js'

export const MIXED = '__mixed__' as const

export type StyleValue<K extends keyof Style> = Style[K] | typeof MIXED

export type SelectionStyle = {
  [K in keyof Style]: StyleValue<K>
}

export function deriveSelectionStyle(elements: Element[], fallback: Style): SelectionStyle {
  if (elements.length === 0) return { ...fallback }
  return {
    stroke: sharedValue(elements, 'stroke'),
    fill: sharedValue(elements, 'fill'),
    strokeWidth: sharedValue(elements, 'strokeWidth'),
    strokeStyle: sharedValue(elements, 'strokeStyle'),
    opacity: sharedValue(elements, 'opacity'),
    roundness: sharedValue(elements, 'roundness'),
    sloppiness: sharedValue(elements, 'sloppiness'),
    fontSize: sharedValue(elements, 'fontSize'),
    fontFamily: sharedValue(elements, 'fontFamily'),
    textColor: sharedValue(elements, 'textColor'),
    textAlign: sharedValue(elements, 'textAlign'),
  }
}

function sharedValue<K extends keyof Style>(elements: Element[], key: K): StyleValue<K> {
  const first = elements[0]?.style[key]
  const allEqual = elements.every((element) => element.style[key] === first)
  return allEqual ? (first as Style[K]) : MIXED
}
