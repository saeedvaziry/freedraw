import type { ArrowElement, Element, ElementId, SceneSnapshot, ShapeType } from '../model/types.js'
import { deriveIds, nodeLabel } from './identity.js'
import { canonicalEdgeToken, canonicalShapeToken } from './tokens.js'
import type { EdgeStyle } from './ast.js'

export interface SerializeReport {
  text: string
  skipped: { id: ElementId; type: string }[]
}

const NODE_TYPES = new Set<string>(['rect', 'roundRect', 'ellipse', 'diamond', 'triangle', 'cylinder', 'hexagon', 'parallelogram', 'star', 'cloud', 'heart', 'text'])

export function serializeDiagram(snapshot: SceneSnapshot): SerializeReport {
  const ordered = orderedElements(snapshot)
  const nodes = ordered.filter((element) => NODE_TYPES.has(element.type))
  const ids = deriveIds(nodes)
  const skipped: SerializeReport['skipped'] = []

  const declarations = nodes.map((node) => declareNode(ids.get(node.id)!, node))
  const edges: string[] = []

  for (const element of ordered) {
    if (!isArrow(element)) {
      if (!ids.has(element.id)) skipped.push({ id: element.id, type: element.type })
      continue
    }
    const edge = serializeEdge(element, ids)
    if (!edge) {
      skipped.push({ id: element.id, type: element.type })
      continue
    }
    edges.push(edge)
  }

  return { text: ['flowchart TD', ...declarations, ...edges].join('\n'), skipped }
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

  const op = canonicalEdgeToken(edgeStyleOf(arrow)).text
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

function edgeStyleOf(arrow: ArrowElement): EdgeStyle {
  return {
    type: arrow.type,
    startArrowhead: arrow.startArrowhead,
    endArrowhead: arrow.endArrowhead,
    strokeStyle: arrow.style.strokeStyle === 'dotted' || arrow.style.strokeStyle === 'dashed' ? 'dotted' : 'solid',
    thick: arrow.style.strokeWidth >= 4,
  }
}

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}
