import type { Element, Point, SceneSnapshot } from '../model/types.js'
import { elementBounds, elementCenter, hitTestElement } from './hitTest.js'

export const SNAP_DISTANCE = 8

export type SnapGuide =
  | { kind: 'point'; at: Point }
  | { kind: 'line'; from: Point; to: Point }

export interface SnapResult {
  point: Point
  guides: SnapGuide[]
  target: Element | null
}

export function shapeAnchors(element: Element): Point[] {
  const { x, y, width, height } = elementBounds(element)
  const center = elementCenter(element)
  return rotateAll(
    [
      { x: x + width / 2, y },
      { x: x + width, y: y + height / 2 },
      { x: x + width / 2, y: y + height },
      { x, y: y + height / 2 },
    ],
    center,
    element.rotation,
  )
}

function rotateAll(points: Point[], center: Point, angle: number): Point[] {
  if (!angle) return points
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points.map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
  })
}

export function snapToShapes(
  world: Point,
  snapshot: SceneSnapshot,
  threshold: number,
  ignoreId?: string,
): { point: Point; target: Element | null } {
  let best: Point | null = null
  let bestTarget: Element | null = null
  let bestDist = threshold
  for (const id of snapshot.order) {
    if (id === ignoreId) continue
    const element = snapshot.elements[id]
    if (!element || element.type === 'arrow' || element.type === 'line') continue
    for (const anchor of shapeAnchors(element)) {
      const dist = Math.hypot(anchor.x - world.x, anchor.y - world.y)
      if (dist < bestDist) {
        bestDist = dist
        best = anchor
        bestTarget = element
      }
    }
  }
  return { point: best ?? world, target: best ? bestTarget : null }
}

function edgePorts(element: Element): Point[] {
  return shapeAnchors(element).slice(0, 4)
}

function nearestPort(element: Element, world: Point): Point {
  let best = world
  let bestDist = Infinity
  for (const port of edgePorts(element)) {
    const dist = Math.hypot(port.x - world.x, port.y - world.y)
    if (dist < bestDist) {
      bestDist = dist
      best = port
    }
  }
  return best
}

function shapeUnder(world: Point, snapshot: SceneSnapshot, ignoreId?: string): Element | null {
  for (let i = snapshot.order.length - 1; i >= 0; i -= 1) {
    const id = snapshot.order[i]
    if (!id || id === ignoreId) continue
    const element = snapshot.elements[id]
    if (!element || element.type === 'arrow' || element.type === 'line') continue
    if (hitTestElement(world, element)) return element
  }
  return null
}

export function snapEndpoint(
  world: Point,
  snapshot: SceneSnapshot,
  options: { threshold: number; origin?: Point; ignoreId?: string },
): SnapResult {
  const shapeSnap = snapToShapes(world, snapshot, options.threshold, options.ignoreId)
  if (shapeSnap.target) {
    return { point: shapeSnap.point, target: shapeSnap.target, guides: [{ kind: 'point', at: shapeSnap.point }] }
  }
  const over = shapeUnder(world, snapshot, options.ignoreId)
  if (over) {
    const port = nearestPort(over, world)
    return { point: port, target: over, guides: [{ kind: 'point', at: port }] }
  }
  return { point: world, target: null, guides: [] }
}
