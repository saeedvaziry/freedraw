import { arrowRoute } from '../connectors/resolve.js'
import { labelRect } from '../geometry/shape-outline.js'
import { isArrowElement } from '../model/guards.js'
import type { Element } from '../model/types.js'
import { arrowLabelEditRect } from './arrow-label.js'
import type { EditRequest } from './edit.js'

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

  if (isArrowElement(element)) {
    return {
      elementId: element.id,
      target: 'label',
      labelKind: 'arrow',
      text,
      world: arrowLabelEditRect(arrowRoute(element), text, element.style),
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
