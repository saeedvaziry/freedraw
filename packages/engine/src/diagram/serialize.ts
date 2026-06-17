import type { ArrowElement, Element, ElementId, SceneSnapshot, ShapeType } from '../model/types.js'
import { deriveIds, nodeLabel } from './identity.js'
import { DEFAULT_DIRECTION, canonicalEdgeToken, canonicalShapeToken } from './tokens.js'
import type { Direction, EdgeStyle } from './ast.js'

export interface SerializeReport {
  text: string
  skipped: { id: ElementId; type: string }[]
}

const NODE_TYPES = new Set<string>(['rect', 'roundRect', 'ellipse', 'diamond', 'triangle', 'cylinder', 'hexagon', 'parallelogram', 'star', 'cloud', 'heart', 'text'])

export function serializeDiagram(snapshot: SceneSnapshot): SerializeReport {
  const ordered = orderedElements(snapshot)
  const nodes = ordered.filter((element) => NODE_TYPES.has(element.type))
  const ids = deriveIds(nodes)
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const skipped: SerializeReport['skipped'] = []

  const declarations = nodes.map((node) => declareNode(ids.get(node.id)!, node))
  const edges: string[] = []
  const boundArrows: ArrowElement[] = []

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
    boundArrows.push(element)
    edges.push(edge)
  }

  const direction = inferDirection(boundArrows, byId)
  return { text: [`flowchart ${direction}`, ...declarations, ...edges].join('\n'), skipped }
}

function inferDirection(arrows: ArrowElement[], nodes: Map<ElementId, Element>): Direction {
  let dx = 0
  let dy = 0
  for (const arrow of arrows) {
    const source = nodes.get(arrow.start!.elementId!)
    const target = nodes.get(arrow.end!.elementId!)
    if (!source || !target) continue
    dx += centerX(target) - centerX(source)
    dy += centerY(target) - centerY(source)
  }
  if (dx === 0 && dy === 0) return DEFAULT_DIRECTION
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'LR' : 'RL'
  return dy >= 0 ? 'TD' : 'BT'
}

function centerX(element: Element): number {
  return element.x + element.width / 2
}

function centerY(element: Element): number {
  return element.y + element.height / 2
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
