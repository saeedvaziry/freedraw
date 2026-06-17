import { parseDiagram } from '@freedraw/engine/diagram'
import type { ParseOptions, DiagramError } from '@freedraw/engine/diagram'
import { defaultAppState } from '@freedraw/engine/model/schema'
import type { Element, ElementId, SceneSnapshot } from '@freedraw/engine/model/types'
import { resolveDiagramArrows } from './resolve.js'
import { defaultDiagramLayout, defaultDiagramStyle } from './style.js'

export type BuildSceneOptions = ParseOptions

export interface DiagramScene {
  snapshot: SceneSnapshot
  errors: DiagramError[]
}

export function buildSceneFromElements(elements: Element[], order: ElementId[]): SceneSnapshot {
  resolveDiagramArrows(elements)
  const map: Record<ElementId, Element> = {}
  for (const element of elements) map[element.id] = element
  return { elements: map, order, appState: defaultAppState() }
}

export function buildScene(text: string, options: BuildSceneOptions = {}): DiagramScene {
  const style = { ...defaultDiagramStyle, ...options.style }
  const layout = {
    ...defaultDiagramLayout,
    ...options.layout,
    minNodeSize: { ...defaultDiagramLayout.minNodeSize, ...options.layout?.minNodeSize },
  }
  const { elements, order, errors } = parseDiagram(text, { ...options, style, layout })
  if (errors.length > 0) {
    return { snapshot: { elements: {}, order: [], appState: defaultAppState() }, errors }
  }
  return { snapshot: buildSceneFromElements(elements, order), errors }
}
