import type { Rect } from '../geometry/rect.js'
import { rotatedBounds } from '../geometry/rotate.js'
import type { ElementId, SceneSnapshot } from '../model/types.js'
import type { SceneStore } from '../store/scene-store.js'
import type { Direction } from './ast.js'
import { layoutDiagram, type LayoutOptions } from './layout.js'
import { sceneToAst } from './scene-graph.js'

export interface TidyMove {
  id: ElementId
  x: number
  y: number
}

export interface TidyPlan {
  moves: TidyMove[]
  nodeIds: ElementId[]
  arrowIds: ElementId[]
  direction: Direction
}

export interface TidyOptions {
  direction?: Direction
  seeds?: Iterable<ElementId> | null
  layout?: LayoutOptions
}

type TidyStore = Pick<SceneStore, 'getSnapshot' | 'transact' | 'stopCapturing'>

const MOVE_EPSILON = 0.5

export function canTidy(snapshot: SceneSnapshot, seeds?: Iterable<ElementId> | null): boolean {
  return sceneToAst(snapshot, { seeds }).ast.edges.length > 0
}

export function planTidy(snapshot: SceneSnapshot, options: TidyOptions = {}): TidyPlan {
  const graph = sceneToAst(snapshot, { direction: options.direction, seeds: options.seeds })
  const plan: TidyPlan = {
    moves: [],
    nodeIds: graph.nodes.map((node) => node.id),
    arrowIds: graph.arrows.map((arrow) => arrow.id),
    direction: graph.ast.direction,
  }
  if (graph.ast.edges.length === 0) return plan

  const bounds = new Map<ElementId, Rect>()
  const sizes = new Map<string, { width: number; height: number }>()
  for (const node of graph.nodes) {
    const box = rotatedBounds(node)
    bounds.set(node.id, box)
    sizes.set(node.id, { width: box.width, height: box.height })
  }

  const anchor = topLeftOf(bounds.values())
  const layout = layoutDiagram(graph.ast, { x: 0, y: 0 }, snapshot.appState.lastUsedStyle, {
    ...options.layout,
    sizes,
  })
  const laidOut = topLeftOf(layout.positions.values())
  const shiftX = anchor.x - laidOut.x
  const shiftY = anchor.y - laidOut.y

  for (const node of graph.nodes) {
    const target = layout.positions.get(node.id)
    const box = bounds.get(node.id)
    if (!target || !box) continue
    const dx = Math.round(target.x + shiftX) - box.x
    const dy = Math.round(target.y + shiftY) - box.y
    if (Math.abs(dx) < MOVE_EPSILON && Math.abs(dy) < MOVE_EPSILON) continue
    plan.moves.push({ id: node.id, x: node.x + dx, y: node.y + dy })
  }

  return plan
}

export function tidyDiagram(store: TidyStore, options: TidyOptions = {}): TidyPlan {
  const plan = planTidy(store.getSnapshot(), options)
  if (plan.moves.length === 0) return plan

  store.stopCapturing()
  store.transact((api) => {
    for (const move of plan.moves) api.updateElement(move.id, { x: move.x, y: move.y })
  })
  store.stopCapturing()
  return plan
}

function topLeftOf(boxes: Iterable<{ x: number; y: number }>): { x: number; y: number } {
  let x = Infinity
  let y = Infinity
  for (const box of boxes) {
    x = Math.min(x, box.x)
    y = Math.min(y, box.y)
  }
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 }
}
