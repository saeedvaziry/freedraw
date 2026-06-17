import { defaultShapeSize } from '../model/factory.js'
import { defaultStyle } from '../model/schema.js'
import { measureTextBox } from '../text/size.js'
import type { Point, ShapeType, Style } from '../model/types.js'
import type { AstNode, DiagramAst, Direction } from './ast.js'

export interface NodeBox {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutResult {
  positions: Map<string, NodeBox>
}

interface BoxSize {
  width: number
  height: number
}

const LAYER_GAP = 140
const SIBLING_GAP = 90

const SHAPE_TEXT_INFLATION: Partial<Record<ShapeType, { x: number; y: number }>> = {
  diamond: { x: 1.7, y: 1.7 },
  ellipse: { x: 1.4, y: 1.4 },
  hexagon: { x: 1.3, y: 1 },
  triangle: { x: 1.6, y: 1.8 },
}

export function layoutDiagram(
  ast: DiagramAst,
  origin: Point = { x: 0, y: 0 },
  style: Style = defaultStyle,
): LayoutResult {
  const order = ast.nodes.map((node) => node.id)
  const forward = forwardEdges(ast, order)
  const layers = assignLayers(order, forward)
  const lanes = groupByLayer(order, layers)
  const components = componentBands(order, ast)
  const widest = Math.max(...[...lanes.values()].map((ids) => ids.length), 1)
  const size = uniformBox(ast.nodes, style)

  const positions = new Map<string, NodeBox>()
  for (const [layer, ids] of lanes) {
    ids.forEach((id, lane) => {
      positions.set(id, place(layer, lane, ids.length, widest, components.get(id) ?? 0, ast.direction, origin, size))
    })
  }

  return { positions }
}

function uniformBox(nodes: AstNode[], style: Style): BoxSize {
  let width = 0
  let height = 0
  for (const node of nodes) {
    const box = nodeBox(node, style)
    width = Math.max(width, box.width)
    height = Math.max(height, box.height)
  }
  return { width, height }
}

function nodeBox(node: AstNode, style: Style): BoxSize {
  const floor = defaultShapeSize(node.shape)
  if (node.text.length === 0) return floor
  const text = measureTextBox(node.text, style)
  const inflation = SHAPE_TEXT_INFLATION[node.shape] ?? { x: 1, y: 1 }
  return {
    width: Math.max(floor.width, Math.ceil(text.width * inflation.x)),
    height: Math.max(floor.height, Math.ceil(text.height * inflation.y)),
  }
}

function forwardEdges(ast: DiagramAst, order: string[]): Map<string, string[]> {
  const index = new Map(order.map((id, position) => [id, position]))
  const stack = new Set<string>()
  const visited = new Set<string>()
  const adjacency = new Map<string, string[]>()
  for (const id of order) adjacency.set(id, [])
  for (const edge of ast.edges) adjacency.get(edge.source)?.push(edge.target)

  const forward = new Map<string, string[]>()
  for (const id of order) forward.set(id, [])

  const frames: { id: string; cursor: number }[] = []
  const enter = (id: string): void => {
    visited.add(id)
    stack.add(id)
    frames.push({ id, cursor: 0 })
  }

  for (const id of [...order].sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0))) {
    if (visited.has(id)) continue
    enter(id)
    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!
      const targets = adjacency.get(frame.id) ?? []
      if (frame.cursor >= targets.length) {
        stack.delete(frame.id)
        frames.pop()
        continue
      }
      const target = targets[frame.cursor]!
      frame.cursor += 1
      if (stack.has(target)) continue
      forward.get(frame.id)?.push(target)
      if (!visited.has(target)) enter(target)
    }
  }

  return forward
}

function assignLayers(order: string[], forward: Map<string, string[]>): Map<string, number> {
  const incoming = new Map<string, number>()
  for (const id of order) incoming.set(id, 0)
  for (const targets of forward.values()) {
    for (const target of targets) incoming.set(target, (incoming.get(target) ?? 0) + 1)
  }

  const layer = new Map<string, number>()
  const queue = order.filter((id) => (incoming.get(id) ?? 0) === 0)
  for (const id of queue) layer.set(id, 0)

  while (queue.length > 0) {
    const id = queue.shift()!
    const current = layer.get(id) ?? 0
    for (const target of forward.get(id) ?? []) {
      layer.set(target, Math.max(layer.get(target) ?? 0, current + 1))
      incoming.set(target, (incoming.get(target) ?? 0) - 1)
      if ((incoming.get(target) ?? 0) === 0) queue.push(target)
    }
  }

  for (const id of order) if (!layer.has(id)) layer.set(id, 0)
  return layer
}

function groupByLayer(order: string[], layers: Map<string, number>): Map<number, string[]> {
  const lanes = new Map<number, string[]>()
  for (const id of order) {
    const layer = layers.get(id) ?? 0
    const lane = lanes.get(layer) ?? []
    lane.push(id)
    lanes.set(layer, lane)
  }
  return lanes
}

function componentBands(order: string[], ast: DiagramAst): Map<string, number> {
  const adjacency = new Map<string, Set<string>>()
  for (const id of order) adjacency.set(id, new Set())
  for (const edge of ast.edges) {
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }

  const band = new Map<string, number>()
  let current = 0
  for (const id of order) {
    if (band.has(id)) continue
    const stack = [id]
    while (stack.length > 0) {
      const next = stack.pop()!
      if (band.has(next)) continue
      band.set(next, current)
      for (const neighbor of adjacency.get(next) ?? []) stack.push(neighbor)
    }
    current += 1
  }
  return band
}

function place(
  layer: number,
  lane: number,
  count: number,
  widest: number,
  band: number,
  direction: Direction,
  origin: Point,
  size: BoxSize,
): NodeBox {
  const { width, height } = size
  const vertical = direction === 'TD' || direction === 'TB' || direction === 'BT'
  const crossPitch = (vertical ? width : height) + SIBLING_GAP
  const cross = (lane - (count - 1) / 2) * crossPitch + ((widest - 1) / 2) * crossPitch
  const bandSpan = widest * crossPitch + LAYER_GAP * 2

  if (!vertical) {
    const x = direction === 'RL' ? -layer * (width + LAYER_GAP) : layer * (width + LAYER_GAP)
    return { x: origin.x + x, y: origin.y + cross + band * bandSpan, width, height }
  }

  const y = direction === 'BT' ? -layer * (height + LAYER_GAP) : layer * (height + LAYER_GAP)
  return { x: origin.x + cross, y: origin.y + y + band * bandSpan, width, height }
}
