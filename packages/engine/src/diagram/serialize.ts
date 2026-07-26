import type { ArrowElement, Element, ElementId, SceneSnapshot, ShapeType } from '../model/types.js'
import { isArrowElement } from '../model/guards.js'
import { deriveIds, nodeLabel } from './identity.js'
import { inferDiagramDirection } from './scene-graph.js'
import { arrowEdgeStyle, canonicalEdgeToken, canonicalShapeToken } from './tokens.js'

export interface SerializeReport {
  text: string
  skipped: { id: ElementId; type: string }[]
}

const NODE_TYPES = new Set<string>(['rect', 'roundRect', 'ellipse', 'diamond', 'triangle', 'cylinder', 'hexagon', 'parallelogram', 'star', 'cloud', 'heart', 'lightning', 'text'])

export function serializeDiagram(snapshot: SceneSnapshot): SerializeReport {
  const ordered = orderedElements(snapshot)
  const nodes = ordered.filter((element) => NODE_TYPES.has(element.type))
  const ids = deriveIds(nodes)
  const skipped: SerializeReport['skipped'] = []

  const declarations = nodes.map((node) => declareNode(ids.get(node.id)!, node))
  const edges: string[] = []
  const boundArrows: ArrowElement[] = []

  for (const element of ordered) {
    if (!isArrowElement(element)) {
      if (!ids.has(element.id)) skipped.push({ id: element.id, type: element.type })
      continue
    }
    const edge = serializeEdge(element, ids)
    if (!edge) {
      skipped.push({ id: element.id, type: element.type })
      continue
    }
    boundArrows.push(element)
    edges.push(edge)
  }

  const direction = inferDiagramDirection(boundArrows, snapshot.elements)
  return { text: [`flowchart ${direction}`, ...declarations, ...edges].join('\n'), skipped }
}

function orderedElements(snapshot: SceneSnapshot): Element[] {
  return snapshot.order.map((id) => snapshot.elements[id]).filter((element): element is Element => Boolean(element))
}

function serializeEdge(arrow: ArrowElement, ids: Map<string, string>): string | null {
  const sourceId = arrow.start?.elementId
  const targetId = arrow.end?.elementId
  if (!sourceId || !targetId) return null
  const source = ids.get(sourceId)
  const target = ids.get(targetId)
  if (!source || !target) return null

  const op = canonicalEdgeToken(arrowEdgeStyle(arrow)).text
  const label = arrow.label?.text ? `|${arrow.label.text}|` : ''
  return `${source} ${op}${label} ${target}`
}

function declareNode(id: string, node: Element): string {
  const text = nodeLabel(node)
  if (node.type === 'text') return `${id}[${escapeText(text || id)}]`
  const token = canonicalShapeToken(node.type as ShapeType)
  return `${id}${token.open}${escapeText(text || id)}${token.close}`
}

function escapeText(text: string): string {
  return /[[\](){}|<>"]/.test(text) ? `"${text.replace(/"/g, "'")}"` : text
}
