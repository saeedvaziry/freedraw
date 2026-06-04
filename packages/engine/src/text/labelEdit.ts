import { arrowRoute } from '../connectors/resolve.js'
import { labelRect } from '../geometry/shapeOutline.js'
import type { ArrowElement, Element } from '../model/types.js'
import { polylineMidpoint } from './arrowLabel.js'
import type { EditRequest } from './edit.js'

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow'
}

interface LabelEditOptions {
  selectAll: boolean
}

export function labelEditRequest(
  element: Element,
  text: string,
  options: LabelEditOptions,
): EditRequest {
  if (element.type === 'text') {
    return {
      elementId: element.id,
      target: 'text',
      text,
      world: { x: element.x, y: element.y, width: element.width, height: element.height },
      style: element.style,
      align: element.style.textAlign,
      verticalAlign: 'top',
      selectAll: options.selectAll,
    }
  }

  if (isArrow(element)) {
    const mid = polylineMidpoint(arrowRoute(element))
    return {
      elementId: element.id,
      target: 'label',
      text,
      world: { x: mid.x, y: mid.y, width: 0, height: element.style.fontSize },
      style: element.style,
      align: 'center',
      verticalAlign: 'middle',
      selectAll: options.selectAll,
    }
  }

  return {
    elementId: element.id,
    target: 'label',
    text,
    world: labelRect(element.type, element),
    style: element.style,
    align: element.label?.align ?? element.style.textAlign,
    verticalAlign: element.label?.verticalAlign ?? 'middle',
    selectAll: options.selectAll,
  }
}
