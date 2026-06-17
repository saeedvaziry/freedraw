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

export interface LayoutOptions {
  layerGap?: number
  siblingGap?: number
  uniform?: boolean
  minNodeSize?: { width?: number; height?: number }
}

interface BoxSize {
  width: number
  height: number
}

interface ResolvedLayout {
  layerGap: number
  siblingGap: number
  uniform: boolean
}

const DEFAULT_LAYER_GAP = 140
const DEFAULT_SIBLING_GAP = 90

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
  options: LayoutOptions = {},
): LayoutResult {
  const config = resolveLayout(options)
  const order = ast.nodes.map((node) => node.id)
  const forward = forwardEdges(ast, order)
  const layers = assignLayers(order, forward)
  const components = componentBands(order, ast)

  const sizes = nodeSizes(ast.nodes, style, options.minNodeSize, config.uniform)
  const vertical = isVertical(ast.direction)
  const mainSign = ast.direction === 'RL' || ast.direction === 'BT' ? -1 : 1

  const mainOffsets = layerMainOffsets(layers, sizes, vertical, config.layerGap)
  const children = placementTree(order, forward)

  const positions = new Map<string, NodeBox>()
  let bandMain = 0
  for (const band of bandOrder(order, components)) {
    const span = placeBand(band.ids, layers, sizes, children, mainOffsets, vertical, mainSign, config, origin, bandMain, positions)
    bandMain += span + config.layerGap
  }

  return { positions }
}

function resolveLayout(options: LayoutOptions): ResolvedLayout {
  return {
    layerGap: options.layerGap ?? DEFAULT_LAYER_GAP,
    siblingGap: options.siblingGap ?? DEFAULT_SIBLING_GAP,
    uniform: options.uniform ?? false,
  }
}

function isVertical(direction: Direction): boolean {
  return direction === 'TD' || direction === 'TB' || direction === 'BT'
}

function placeBand(
  bandIds: string[],
  layers: Map<string, number>,
  sizes: Map<string, BoxSize>,
  children: Map<string, string[]>,
  mainOffsets: Map<number, number>,
  vertical: boolean,
  mainSign: number,
  config: ResolvedLayout,
  origin: Point,
  bandMain: number,
  positions: Map<string, NodeBox>,
): number {
  const centers = assignCrossCenters(bandIds, sizes, children, vertical, config.siblingGap)
  let mainSpan = 0

  for (const id of bandIds) {
    const layer = layers.get(id) ?? 0
    const layerMain = mainOffsets.get(layer) ?? 0
    const size = sizes.get(id)!
    const mainSize = vertical ? size.height : size.width
    const main = (bandMain + layerMain) * mainSign - (mainSign < 0 ? mainSize : 0)
    const cross = centers.get(id)! - (vertical ? size.width : size.height) / 2
    positions.set(id, toBox(vertical, main, cross, size, origin))
    mainSpan = Math.max(mainSpan, layerMain + mainSize)
  }

  return mainSpan
}

function assignCrossCenters(
  bandIds: string[],
  sizes: Map<string, BoxSize>,
  children: Map<string, string[]>,
  vertical: boolean,
  gap: number,
): Map<string, number> {
  const member = new Set(bandIds)
  const centers = new Map<string, number>()
  const crossSize = (id: string): number => (vertical ? sizes.get(id)!.width : sizes.get(id)!.height)
  const kidsOf = (id: string): string[] => (children.get(id) ?? []).filter((kid) => member.has(kid))

  let cursor = 0
  const enter = (id: string): void => {
    centers.set(id, cursor + crossSize(id) / 2)
    cursor += crossSize(id) + gap
  }
  const settle = (id: string): void => {
    const kids = kidsOf(id)
    const center = (centers.get(kids[0]!)! + centers.get(kids[kids.length - 1]!)!) / 2
    centers.set(id, center)
    cursor = Math.max(cursor, center + crossSize(id) / 2 + gap)
  }

  const frames: { id: string; cursor: number }[] = []
  for (const root of bandIds) {
    if (centers.has(root)) continue
    frames.push({ id: root, cursor: 0 })
    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!
      const kids = kidsOf(frame.id)
      if (frame.cursor < kids.length) {
        frames.push({ id: kids[frame.cursor]!, cursor: 0 })
        frame.cursor += 1
        continue
      }
      if (kids.length === 0) enter(frame.id)
      else settle(frame.id)
      frames.pop()
    }
  }

  return centers
}

function placementTree(order: string[], forward: Map<string, string[]>): Map<string, string[]> {
  const parent = new Map<string, string>()
  for (const source of order) {
    for (const target of forward.get(source) ?? []) {
      if (parent.has(target)) continue
      parent.set(target, source)
    }
  }

  const children = new Map<string, string[]>()
  for (const id of order) children.set(id, [])
  for (const id of order) {
    const owner = parent.get(id)
    if (owner !== undefined) children.get(owner)!.push(id)
  }
  return children
}

function layerMainOffsets(
  layers: Map<string, number>,
  sizes: Map<string, BoxSize>,
  vertical: boolean,
  gap: number,
): Map<number, number> {
  const mainSize = new Map<number, number>()
  for (const [id, layer] of layers) {
    const size = vertical ? sizes.get(id)!.height : sizes.get(id)!.width
    mainSize.set(layer, Math.max(mainSize.get(layer) ?? 0, size))
  }

  const offsets = new Map<number, number>()
  let cursor = 0
  for (const layer of [...mainSize.keys()].sort((a, b) => a - b)) {
    offsets.set(layer, cursor)
    cursor += (mainSize.get(layer) ?? 0) + gap
  }
  return offsets
}

function toBox(vertical: boolean, main: number, cross: number, size: BoxSize, origin: Point): NodeBox {
  if (vertical) return { x: origin.x + cross, y: origin.y + main, width: size.width, height: size.height }
  return { x: origin.x + main, y: origin.y + cross, width: size.width, height: size.height }
}

function bandOrder(order: string[], components: Map<string, number>): { band: number; ids: string[] }[] {
  const bands = new Map<number, string[]>()
  for (const id of order) {
    const band = components.get(id) ?? 0
    const ids = bands.get(band) ?? []
    ids.push(id)
    bands.set(band, ids)
  }
  return [...bands.entries()].sort((a, b) => a[0] - b[0]).map(([band, ids]) => ({ band, ids }))
}

function nodeSizes(
  nodes: AstNode[],
  style: Style,
  floor: LayoutOptions['minNodeSize'],
  uniform: boolean,
): Map<string, BoxSize> {
  const sizes = new Map<string, BoxSize>()
  for (const node of nodes) sizes.set(node.id, nodeBox(node, style, floor))
  if (!uniform) return sizes

  let width = 0
  let height = 0
  for (const size of sizes.values()) {
    width = Math.max(width, size.width)
    height = Math.max(height, size.height)
  }
  for (const id of sizes.keys()) sizes.set(id, { width, height })
  return sizes
}

function nodeBox(node: AstNode, style: Style, floor: LayoutOptions['minNodeSize']): BoxSize {
  const base = defaultShapeSize(node.shape)
  const minWidth = floor?.width ?? base.width
  const minHeight = floor?.height ?? base.height
  if (node.text.length === 0) return { width: minWidth, height: minHeight }
  const text = measureTextBox(node.text, style)
  const inflation = SHAPE_TEXT_INFLATION[node.shape] ?? { x: 1, y: 1 }
  return {
    width: Math.max(minWidth, Math.ceil(text.width * inflation.x)),
    height: Math.max(minHeight, Math.ceil(text.height * inflation.y)),
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
