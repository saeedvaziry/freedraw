import { anchorFromPoint } from '../connectors/binding.js'
import { elementCenter } from '../geometry/hitTest.js'
import { createArrow, createShape } from '../model/factory.js'
import type { Element, ElementId, Point, ShapeElement, Style } from '../model/types.js'
import type { AstEdge, AstNode, DiagramAst, EdgeStyle } from './ast.js'
import type { LayoutResult, NodeBox } from './layout.js'

const BINDING_GAP = 6
const THICK_STROKE_WIDTH = 4

export interface BuildResult {
  elements: Element[]
  order: ElementId[]
}

export function buildElements(ast: DiagramAst, layout: LayoutResult, style: Style): BuildResult {
  const shapes = new Map<string, ShapeElement>()
  const elements: Element[] = []

  for (const node of ast.nodes) {
    const box = layout.positions.get(node.id)
    if (!box) continue
    const shape = buildNode(node, box, style)
    shapes.set(node.id, shape)
    elements.push(shape)
  }

  for (const edge of ast.edges) {
    const source = shapes.get(edge.source)
    const target = shapes.get(edge.target)
    if (!source || !target) continue
    elements.push(buildEdge(edge, source, target, style))
  }

  return { elements, order: elements.map((element) => element.id) }
}

function buildNode(node: AstNode, box: NodeBox, style: Style): ShapeElement {
  const shape = createShape({ type: node.shape, x: box.x, y: box.y, width: box.width, height: box.height, style })
  if (node.text.length > 0) shape.label = { text: node.text, align: 'center', verticalAlign: 'middle' }
  return shape
}

function buildEdge(edge: AstEdge, source: ShapeElement, target: ShapeElement, style: Style): Element {
  const direction = edgeDirection(source, target)
  const sourcePort = edgePoint(source, direction)
  const targetPort = edgePoint(target, { x: -direction.x, y: -direction.y })
  const arrow = createArrow({
    type: edge.style.type,
    points: [sourcePort, targetPort],
    start: { elementId: source.id, anchor: anchorFromPoint(source, sourcePort), gap: BINDING_GAP },
    end: { elementId: target.id, anchor: anchorFromPoint(target, targetPort), gap: BINDING_GAP },
    startArrowhead: edge.style.startArrowhead,
    endArrowhead: edge.style.endArrowhead,
    routing: 'orthogonal',
    style: edgeStyle(style, edge.style),
  })
  if (edge.label) arrow.label = { text: edge.label, align: 'center', verticalAlign: 'middle' }
  return arrow
}

function edgeDirection(source: ShapeElement, target: ShapeElement): Point {
  const from = elementCenter(source)
  const to = elementCenter(target)
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx) || 1, y: 0 }
  return { x: 0, y: Math.sign(dy) || 1 }
}

function edgePoint(shape: ShapeElement, direction: Point): Point {
  const center = elementCenter(shape)
  return {
    x: center.x + direction.x * (shape.width / 2),
    y: center.y + direction.y * (shape.height / 2),
  }
}

function edgeStyle(base: Style, edge: EdgeStyle): Partial<Style> {
  return {
    ...base,
    strokeStyle: edge.strokeStyle,
    strokeWidth: edge.thick ? THICK_STROKE_WIDTH : base.strokeWidth,
  }
}
