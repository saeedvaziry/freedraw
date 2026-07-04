import type { Point } from '../../model/types.js'
import type { Rect } from '../../geometry/rect.js'
import { intersects } from '../../geometry/rect.js'
import {
  GEOMETRY_EPSILON,
  obstaclesInRegion,
  pointInAnyObstacle,
  rectFromPoints,
  segmentIntersectsAnyObstacle,
  type Obstacle,
} from './obstacles.js'

const ROUTING_MARGIN = 240

export interface LatticeNode {
  index: number
  point: Point
}

export interface LatticeEdge {
  to: number
  length: number
  direction: Direction
}

export type Direction = 0 | 1

export interface Lattice {
  nodes: LatticeNode[]
  edges: LatticeEdge[][]
  startIndex: number
  endIndex: number
}

export function buildLattice(start: Point, end: Point, obstacles: Obstacle[]): Lattice | null {
  const region = routingRegion(start, end, obstacles)
  const active = obstaclesInRegion(obstacles, region)
  const xRulers = rulers('x', region, start, end, active)
  const yRulers = rulers('y', region, start, end, active)

  const nodes: LatticeNode[] = []
  const indexByKey = new Map<string, number>()
  for (const y of yRulers) {
    for (const x of xRulers) {
      const point = { x, y }
      if (pointInAnyObstacle(point, active)) continue
      const index = nodes.length
      nodes.push({ index, point })
      indexByKey.set(nodeKey(x, y), index)
    }
  }

  const startIndex = indexByKey.get(nodeKey(start.x, start.y))
  const endIndex = indexByKey.get(nodeKey(end.x, end.y))
  if (startIndex === undefined || endIndex === undefined) return null

  const edges: LatticeEdge[][] = nodes.map(() => [])
  for (const y of yRulers) {
    for (let i = 0; i < xRulers.length - 1; i += 1) {
      const a = indexByKey.get(nodeKey(xRulers[i]!, y))
      const b = indexByKey.get(nodeKey(xRulers[i + 1]!, y))
      if (a === undefined || b === undefined) continue
      connectIfClear(nodes, edges, a, b, active, 0)
    }
  }
  for (const x of xRulers) {
    for (let i = 0; i < yRulers.length - 1; i += 1) {
      const a = indexByKey.get(nodeKey(x, yRulers[i]!))
      const b = indexByKey.get(nodeKey(x, yRulers[i + 1]!))
      if (a === undefined || b === undefined) continue
      connectIfClear(nodes, edges, a, b, active, 1)
    }
  }

  return { nodes, edges, startIndex, endIndex }
}

function connectIfClear(
  nodes: LatticeNode[],
  edges: LatticeEdge[][],
  a: number,
  b: number,
  obstacles: Obstacle[],
  direction: Direction,
): void {
  const from = nodes[a]!.point
  const to = nodes[b]!.point
  if (segmentIntersectsAnyObstacle(from, to, obstacles)) return
  const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
  edges[a]!.push({ to: b, length, direction })
  edges[b]!.push({ to: a, length, direction })
}

function routingRegion(start: Point, end: Point, obstacles: Obstacle[]): Rect {
  let region = rectFromPoints([start, end], ROUTING_MARGIN)
  for (const obstacle of obstacles) {
    if (!intersects(region, obstacle.rect)) continue
    const rect = obstacle.rect
    const minX = Math.min(region.x, rect.x - ROUTING_MARGIN / 4)
    const minY = Math.min(region.y, rect.y - ROUTING_MARGIN / 4)
    const maxX = Math.max(region.x + region.width, rect.x + rect.width + ROUTING_MARGIN / 4)
    const maxY = Math.max(region.y + region.height, rect.y + rect.height + ROUTING_MARGIN / 4)
    region = { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  return region
}

function rulers(axis: 'x' | 'y', region: Rect, start: Point, end: Point, obstacles: Obstacle[]): number[] {
  const values: number[] = []
  const min = axis === 'x' ? region.x : region.y
  const max = axis === 'x' ? region.x + region.width : region.y + region.height
  push(values, min)
  push(values, max)
  push(values, axis === 'x' ? start.x : start.y)
  push(values, axis === 'x' ? end.x : end.y)
  push(values, axis === 'x' ? (start.x + end.x) / 2 : (start.y + end.y) / 2)

  for (const obstacle of obstacles) {
    const rect = obstacle.rect
    const low = axis === 'x' ? rect.x : rect.y
    const high = axis === 'x' ? rect.x + rect.width : rect.y + rect.height
    const mid = (low + high) / 2
    push(values, low)
    push(values, high)
    push(values, mid)
  }

  const sortedEdges = values
    .filter((value) => value >= min - GEOMETRY_EPSILON && value <= max + GEOMETRY_EPSILON)
    .sort((a, b) => a - b)
  for (let i = 0; i < sortedEdges.length - 1; i += 1) {
    const a = sortedEdges[i]!
    const b = sortedEdges[i + 1]!
    if (b - a > GEOMETRY_EPSILON * 2) push(values, (a + b) / 2)
  }

  return uniqueSorted(values.filter((value) => value >= min - GEOMETRY_EPSILON && value <= max + GEOMETRY_EPSILON))
}

function push(values: number[], value: number): void {
  if (Number.isFinite(value)) values.push(clean(value))
}

function uniqueSorted(values: number[]): number[] {
  const sorted = values.map(clean).sort((a, b) => a - b)
  const result: number[] = []
  for (const value of sorted) {
    const last = result[result.length - 1]
    if (last !== undefined && Math.abs(last - value) <= GEOMETRY_EPSILON) continue
    result.push(value)
  }
  return result
}

function clean(value: number): number {
  return Math.abs(value) <= GEOMETRY_EPSILON ? 0 : Number(value.toFixed(6))
}

function nodeKey(x: number, y: number): string {
  return `${clean(x)},${clean(y)}`
}
