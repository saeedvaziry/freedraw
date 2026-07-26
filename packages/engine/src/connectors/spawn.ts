import { elementBounds, elementCenter } from '../geometry/hit-test.js'
import { isArrowElement } from '../model/guards.js'
import { intersects, type Rect } from '../geometry/rect.js'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement, Element, ElementId, Point, SceneSnapshot, ShapeElement, ShapeType, Style } from '../model/types.js'
import type { SceneStore } from '../store/scene-store.js'
import { createBinding } from './binding.js'

type Store = Pick<SceneStore, 'transact' | 'stopCapturing' | 'setUiState' | 'getLastUsedStyle' | 'getSnapshot'> &
  Partial<Pick<SceneStore, 'scopedSnapshot'>>

export function obstacleBounds(snapshot: SceneSnapshot, exclude: ElementId): Rect[] {
  const bounds: Rect[] = []
  for (const id of snapshot.order) {
    if (id === exclude) continue
    const element = snapshot.elements[id]
    if (!element || isArrowElement(element)) continue
    bounds.push(elementBounds(element))
  }
  return bounds
}

const SHAPE_FALLBACK: ShapeType = 'rect'

function shapeTypeOf(element: Element): ShapeType {
  if (element.type === 'arrow' || element.type === 'line') return SHAPE_FALLBACK
  if (element.type === 'sticky' || element.type === 'text' || element.type === 'image' || element.type === 'freedraw') {
    return SHAPE_FALLBACK
  }
  return element.type
}

function plainShapeType(element: Element): ShapeType | undefined {
  if (isArrowElement(element)) return undefined
  if (element.type === 'sticky' || element.type === 'text' || element.type === 'image' || element.type === 'freedraw') {
    return undefined
  }
  return element.type
}

export type SpawnDirection = 'left' | 'right' | 'up' | 'down'

const SPAWN_GAP = 120
const MAX_SPAWN_STEPS = 100

const vectors: Record<SpawnDirection, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

export function inferSpawnDirection(source: Element, target: Element): SpawnDirection {
  const from = elementCenter(source)
  const to = elementCenter(target)
  const delta: Point = { x: to.x - from.x, y: to.y - from.y }
  let best: SpawnDirection = 'right'
  let bestDot = -Infinity
  for (const direction of Object.keys(vectors) as SpawnDirection[]) {
    const vector = vectors[direction]
    const dot = vector.x * delta.x + vector.y * delta.y
    if (dot > bestDot) {
      bestDot = dot
      best = direction
    }
  }
  return best
}

export interface SpawnPlan {
  target: ShapeElement
  arrow: ArrowElement
}

export function spawnSearchRegion(bounds: Rect, direction: SpawnDirection): Rect {
  const vector = vectors[direction]
  const alongX = vector.x * (bounds.width + SPAWN_GAP)
  const alongY = vector.y * (bounds.height + SPAWN_GAP)
  const perpStep = vector.x !== 0 ? bounds.height + SPAWN_GAP : bounds.width + SPAWN_GAP
  const reach = Math.ceil(MAX_SPAWN_STEPS / 2) * perpStep
  const spreadX = vector.x !== 0 ? 0 : reach
  const spreadY = vector.x !== 0 ? reach : 0
  return {
    x: bounds.x + alongX - spreadX,
    y: bounds.y + alongY - spreadY,
    width: bounds.width + spreadX * 2,
    height: bounds.height + spreadY * 2,
  }
}

function isFree(rect: Rect, obstacles: Rect[]): boolean {
  return !obstacles.some((obstacle) => intersects(rect, obstacle))
}

function freeSlot(bounds: Rect, vector: Point, obstacles: Rect[]): Point {
  const alongX = vector.x * (bounds.width + SPAWN_GAP)
  const alongY = vector.y * (bounds.height + SPAWN_GAP)
  const perpStep = vector.x !== 0 ? bounds.height + SPAWN_GAP : bounds.width + SPAWN_GAP
  const perp: Point = { x: vector.x !== 0 ? 0 : 1, y: vector.x !== 0 ? 1 : 0 }

  for (let i = 0; i < MAX_SPAWN_STEPS; i += 1) {
    const lane = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 === 1 ? 1 : -1)
    const x = bounds.x + alongX + perp.x * lane * perpStep
    const y = bounds.y + alongY + perp.y * lane * perpStep
    if (isFree({ x, y, width: bounds.width, height: bounds.height }, obstacles)) return { x, y }
  }
  return { x: bounds.x + alongX, y: bounds.y + alongY }
}

export function planConnectedShape(
  source: Element,
  direction: SpawnDirection,
  arrowStyle: Style,
  typeOverride?: ShapeType,
  obstacles: Rect[] = [],
): SpawnPlan {
  const vector = vectors[direction]
  const bounds = elementBounds(source)

  const slot = freeSlot(bounds, vector, obstacles)
  const target = createShape({
    type: typeOverride ?? shapeTypeOf(source),
    x: slot.x,
    y: slot.y,
    width: bounds.width,
    height: bounds.height,
    style: { ...source.style },
  })

  const center = elementCenter(source)

  const sourceEdge: Point = {
    x: center.x + vector.x * (bounds.width / 2),
    y: center.y + vector.y * (bounds.height / 2),
  }
  const targetCenter = elementCenter(target)
  const targetEdge: Point = {
    x: targetCenter.x - vector.x * (target.width / 2),
    y: targetCenter.y - vector.y * (target.height / 2),
  }

  const arrow = createArrow({
    points: [sourceEdge, targetEdge],
    start: createBinding(source, sourceEdge, 6, targetEdge),
    end: createBinding(target, targetEdge, 6, sourceEdge),
    routing: 'orthogonal',
    style: arrowStyle,
  })

  return { target, arrow }
}

export function spawnConnectedShape(
  store: Store,
  source: Element,
  direction: SpawnDirection,
  typeOverride?: ShapeType,
): string {
  const region = spawnSearchRegion(elementBounds(source), direction)
  const scene = store.scopedSnapshot?.(region) ?? store.getSnapshot()
  const obstacles = obstacleBounds(scene, source.id)
  const { target, arrow } = planConnectedShape(source, direction, store.getLastUsedStyle(), typeOverride, obstacles)
  store.transact((api) => {
    api.addElement(target)
    api.addElement(arrow)
  })
  store.stopCapturing()
  store.setUiState({ selectedIds: new Set([target.id]) })
  return target.id
}

export function spawnSiblingShape(store: Store, parent: Element, existingChild: Element): string {
  const direction = inferSpawnDirection(parent, existingChild)
  return spawnConnectedShape(store, parent, direction, plainShapeType(existingChild))
}
