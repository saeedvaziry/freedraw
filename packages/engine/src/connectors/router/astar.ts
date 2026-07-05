import type { Point } from '../../model/types.js'
import type { Direction, Lattice } from './lattice.js'

const BEND_PENALTY = 48

interface SearchState {
  node: number
  direction: Direction | -1
}

interface Score {
  cost: number
  bends: number
}

interface QueueEntry extends SearchState, Score {
  estimate: number
  parentKey: string | null
}

export function findRoute(lattice: Lattice): Point[] | null {
  if (lattice.startIndex === lattice.endIndex) {
    return [lattice.nodes[lattice.startIndex]!.point]
  }

  const best = new Map<string, Score>()
  const parent = new Map<string, string | null>()
  const queue: QueueEntry[] = []
  const start: QueueEntry = {
    node: lattice.startIndex,
    direction: -1,
    cost: 0,
    bends: 0,
    estimate: heuristic(lattice, lattice.startIndex),
    parentKey: null,
  }
  push(queue, start)
  best.set(stateKey(start), { cost: 0, bends: 0 })
  parent.set(stateKey(start), null)

  while (queue.length > 0) {
    const current = pop(queue)!
    const currentKey = stateKey(current)
    const currentBest = best.get(currentKey)
    if (!currentBest || currentBest.cost !== current.cost || currentBest.bends !== current.bends) continue
    if (current.node === lattice.endIndex) return reconstruct(lattice, parent, currentKey)

    const edges = [...lattice.edges[current.node]!].sort((a, b) => a.to - b.to)
    for (const edge of edges) {
      const bends = current.bends + (current.direction !== -1 && current.direction !== edge.direction ? 1 : 0)
      const bendCost = bends - current.bends > 0 ? BEND_PENALTY : 0
      const cost = current.cost + edge.length + bendCost
      const next: QueueEntry = {
        node: edge.to,
        direction: edge.direction,
        cost,
        bends,
        estimate: cost + heuristic(lattice, edge.to),
        parentKey: currentKey,
      }
      const key = stateKey(next)
      const previous = best.get(key)
      if (previous && compareScore(previous, next) <= 0) continue
      best.set(key, { cost, bends })
      parent.set(key, currentKey)
      push(queue, next)
    }
  }

  return null
}

function reconstruct(lattice: Lattice, parent: Map<string, string | null>, key: string): Point[] {
  const keys: string[] = []
  let current: string | null = key
  while (current) {
    keys.push(current)
    current = parent.get(current) ?? null
  }
  keys.reverse()
  return keys.map((state) => lattice.nodes[Number(state.split(':')[0])]!.point)
}

function push(queue: QueueEntry[], entry: QueueEntry): void {
  queue.push(entry)
}

function pop(queue: QueueEntry[]): QueueEntry | undefined {
  let bestIndex = 0
  for (let i = 1; i < queue.length; i += 1) {
    if (compareEntry(queue[i]!, queue[bestIndex]!) < 0) bestIndex = i
  }
  const [entry] = queue.splice(bestIndex, 1)
  return entry
}

function compareEntry(a: QueueEntry, b: QueueEntry): number {
  if (a.estimate !== b.estimate) return a.estimate - b.estimate
  if (a.bends !== b.bends) return a.bends - b.bends
  const aH = a.estimate - a.cost
  const bH = b.estimate - b.cost
  if (aH !== bH) return aH - bH
  if (a.node !== b.node) return a.node - b.node
  return a.direction - b.direction
}

function compareScore(a: Score, b: Score): number {
  if (a.cost !== b.cost) return a.cost - b.cost
  return a.bends - b.bends
}

function heuristic(lattice: Lattice, node: number): number {
  const point = lattice.nodes[node]!.point
  const end = lattice.nodes[lattice.endIndex]!.point
  return Math.abs(end.x - point.x) + Math.abs(end.y - point.y)
}

function stateKey(state: SearchState): string {
  return `${state.node}:${state.direction}`
}
