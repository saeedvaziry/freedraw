import { elementBounds, elementCenter } from '../geometry/hitTest.js'
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

export function planConnectedShape(
  source: Element,
  direction: SpawnDirection,
  arrowStyle: Style,
  typeOverride?: ShapeType,
): SpawnPlan {
  const vector = vectors[direction]
  const bounds = elementBounds(source)
  const center = elementCenter(source)

  const offsetX = vector.x * (bounds.width + SPAWN_GAP)
  const offsetY = vector.y * (bounds.height + SPAWN_GAP)
  const target = createShape({
    type: typeOverride ?? shapeTypeOf(source),
    x: bounds.x + offsetX,
    y: bounds.y + offsetY,
    width: bounds.width,
    height: bounds.height,
    style: { ...source.style },
  })

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
): string {
  const { target, arrow } = planConnectedShape(source, direction, store.getLastUsedStyle(), typeOverride)
  store.transact((api) => {
    api.addElement(target)
    api.addElement(arrow)
  })
  store.stopCapturing()
  store.setUiState({ selectedIds: new Set([target.id]) })
  return target.id
}
