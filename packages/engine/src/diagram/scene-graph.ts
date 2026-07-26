import { isArrowElement } from '../model/guards.js'
import type { ArrowElement, Element, ElementId, SceneSnapshot, ShapeType } from '../model/types.js'
import type { AstEdge, AstNode, DiagramAst, Direction } from './ast.js'
import { nodeLabel } from './identity.js'
import { arrowEdgeStyle, DEFAULT_DIRECTION } from './tokens.js'

export interface SceneGraph {
  ast: DiagramAst
  nodes: Element[]
  arrows: ArrowElement[]
}

export interface SceneGraphOptions {
  direction?: Direction
  seeds?: Iterable<ElementId> | null
}

interface Link {
  arrow: ArrowElement
  source: ElementId
  target: ElementId
}

const SHAPE_NODE_TYPES: ReadonlySet<string> = new Set<ShapeType>([
  'rect',
  'roundRect',
  'ellipse',
  'diamond',
  'triangle',
  'cylinder',
  'hexagon',
  'parallelogram',
  'star',
  'cloud',
  'heart',
  'lightning',
])

const BOX_NODE_TYPES: ReadonlySet<string> = new Set(['text', 'sticky', 'image'])

export function diagramNodeShape(element: Element): ShapeType | null {
  if (SHAPE_NODE_TYPES.has(element.type)) return element.type as ShapeType
  if (BOX_NODE_TYPES.has(element.type)) return 'rect'
  return null
}

export function sceneToAst(snapshot: SceneSnapshot, options: SceneGraphOptions = {}): SceneGraph {
  const ordered = orderedElements(snapshot)
  const candidates = candidateNodes(ordered)
  const links = candidateLinks(ordered, candidates)
  const neighbors = adjacency(links)
  const reach = reachableIds(options.seeds, candidates, links, neighbors)

  const nodes = ordered.filter((element) => participates(element.id, candidates, neighbors, reach))
  const member = new Set(nodes.map((node) => node.id))
  const edges = links.filter((link) => member.has(link.source) && member.has(link.target))
  const arrows = edges.map((link) => link.arrow)

  return {
    ast: {
      direction: options.direction ?? inferDiagramDirection(arrows, snapshot.elements),
      nodes: nodes.map(toAstNode),
      edges: edges.map(toAstEdge),
    },
    nodes,
    arrows,
  }
}

export function inferDiagramDirection(
  arrows: ArrowElement[],
  elements: Record<ElementId, Element>,
): Direction {
  let dx = 0
  let dy = 0
  for (const arrow of arrows) {
    const source = arrow.start ? elements[arrow.start.elementId] : undefined
    const target = arrow.end ? elements[arrow.end.elementId] : undefined
    if (!source || !target) continue
    dx += centerX(target) - centerX(source)
    dy += centerY(target) - centerY(source)
  }
  if (dx === 0 && dy === 0) return DEFAULT_DIRECTION
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'LR' : 'RL'
  return dy >= 0 ? 'TD' : 'BT'
}

function participates(
  id: ElementId,
  candidates: Map<ElementId, Element>,
  neighbors: Map<ElementId, ElementId[]>,
  reach: Set<ElementId> | null,
): boolean {
  if (!candidates.has(id) || !neighbors.has(id)) return false
  return reach === null || reach.has(id)
}

function orderedElements(snapshot: SceneSnapshot): Element[] {
  const seen = new Set<ElementId>()
  const ordered: Element[] = []
  for (const id of snapshot.order) {
    const element = snapshot.elements[id]
    if (!element || seen.has(id)) continue
    seen.add(id)
    ordered.push(element)
  }
  return ordered
}

function candidateNodes(ordered: Element[]): Map<ElementId, Element> {
  const candidates = new Map<ElementId, Element>()
  for (const element of ordered) {
    if (element.locked || isArrowElement(element)) continue
    if (diagramNodeShape(element) === null) continue
    candidates.set(element.id, element)
  }
  return candidates
}

function candidateLinks(ordered: Element[], candidates: Map<ElementId, Element>): Link[] {
  const links: Link[] = []
  for (const element of ordered) {
    if (!isArrowElement(element) || element.locked) continue
    const source = element.start?.elementId
    const target = element.end?.elementId
    if (!source || !target || source === target) continue
    if (!candidates.has(source) || !candidates.has(target)) continue
    links.push({ arrow: element, source, target })
  }
  return links
}

function adjacency(links: Link[]): Map<ElementId, ElementId[]> {
  const neighbors = new Map<ElementId, ElementId[]>()
  const connect = (from: ElementId, to: ElementId): void => {
    const list = neighbors.get(from) ?? []
    list.push(to)
    neighbors.set(from, list)
  }
  for (const link of links) {
    connect(link.source, link.target)
    connect(link.target, link.source)
  }
  return neighbors
}

function reachableIds(
  seeds: Iterable<ElementId> | null | undefined,
  candidates: Map<ElementId, Element>,
  links: Link[],
  neighbors: Map<ElementId, ElementId[]>,
): Set<ElementId> | null {
  if (!seeds) return null
  const provided = [...seeds]
  if (provided.length === 0) return null

  const byArrow = new Map(links.map((link) => [link.arrow.id, link]))
  const frontier: ElementId[] = []
  for (const id of provided) {
    if (candidates.has(id)) {
      frontier.push(id)
      continue
    }
    const link = byArrow.get(id)
    if (link) frontier.push(link.source, link.target)
  }

  const reach = new Set<ElementId>()
  while (frontier.length > 0) {
    const id = frontier.pop()!
    if (reach.has(id)) continue
    reach.add(id)
    for (const next of neighbors.get(id) ?? []) frontier.push(next)
  }
  return reach
}

function toAstNode(element: Element): AstNode {
  return { id: element.id, shape: diagramNodeShape(element) ?? 'rect', text: nodeLabel(element) }
}

function toAstEdge(link: Link): AstEdge {
  const label = link.arrow.label?.text
  return {
    source: link.source,
    target: link.target,
    label: label !== undefined && label.length > 0 ? label : undefined,
    style: arrowEdgeStyle(link.arrow),
  }
}

function centerX(element: Element): number {
  return element.x + element.width / 2
}

function centerY(element: Element): number {
  return element.y + element.height / 2
}
