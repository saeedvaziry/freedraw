import { elementBounds, elementCenter } from '../geometry/hitTest.js'
import { intersects, type Rect } from '../geometry/rect.js'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement, Element, ElementId, Point, ShapeElement, ShapeType, Style } from '../model/types.js'
import type { SceneStore } from '../store/SceneStore.js'
import { anchorFromPoint } from './binding.js'

type Store = Pick<SceneStore, 'transact' | 'stopCapturing' | 'setUiState' | 'getLastUsedStyle'>

const SHAPE_FALLBACK: ShapeType = 'rect'

function shapeTypeOf(element: Element): ShapeType {
  if (element.type === 'arrow' || element.type === 'line') return SHAPE_FALLBACK
  if (element.type === 'sticky' || element.type === 'text' || element.type === 'image' || element.type === 'freedraw') {
    return SHAPE_FALLBACK
  }
  return element.type
}

export type SpawnDirection = 'left' | 'right' | 'up' | 'down'

export interface SpawnMenuRequest {
  screen: Point
  sourceId: ElementId
  direction: SpawnDirection
}

const SPAWN_GAP = 120
const MAX_SPAWN_STEPS = 100

const vectors: Record<SpawnDirection, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

export interface SpawnPlan {
  target: ShapeElement
  arrow: ArrowElement
}

function freeSlot(bounds: Rect, vector: Point, obstacles: Rect[]): Point {
  const step = vector.x !== 0 ? bounds.width + SPAWN_GAP : bounds.height + SPAWN_GAP
  let x = bounds.x + vector.x * step
  let y = bounds.y + vector.y * step
  for (let i = 0; i < MAX_SPAWN_STEPS; i += 1) {
    const candidate: Rect = { x, y, width: bounds.width, height: bounds.height }
    if (!obstacles.some((obstacle) => intersects(candidate, obstacle))) break
    x += vector.x * step
    y += vector.y * step
  }
  return { x, y }
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
    start: { elementId: source.id, anchor: anchorFromPoint(source, sourceEdge), gap: 6 },
    end: { elementId: target.id, anchor: anchorFromPoint(target, targetEdge), gap: 6 },
    style: arrowStyle,
  })

  return { target, arrow }
}

export function spawnConnectedShape(
  store: Store,
  source: Element,
  direction: SpawnDirection,
  typeOverride?: ShapeType,
  obstacles: Rect[] = [],
): string {
  const { target, arrow } = planConnectedShape(source, direction, store.getLastUsedStyle(), typeOverride, obstacles)
  store.transact((api) => {
    api.addElement(target)
    api.addElement(arrow)
  })
  store.stopCapturing()
  store.setUiState({ selectedIds: new Set([target.id]) })
  return target.id
}
