import type { Element, Point } from '../model/types.js'
import { elementBounds, elementCenter, selectionBounds } from './hit-test.js'
import type { SelectionFrame } from './handles.js'
import { rotatePoint } from './rotate.js'

const ROTATION_EPSILON = 1e-9
const SIZE_EPSILON = 1e-9
const FULL_TURN = Math.PI * 2

export function selectionFrameFor(
  elements: Element[],
  beforeTransform?: Element[] | null,
): SelectionFrame | null {
  const frame = boundsFrame(elements)
  if (!frame || !beforeTransform) return frame
  return rigidRotationFrame(beforeTransform, elements) ?? frame
}

function boundsFrame(elements: Element[]): SelectionFrame | null {
  if (elements.length === 0) return null
  if (elements.length === 1) {
    const element = elements[0]
    if (!element) return null
    return {
      bounds: elementBounds(element),
      rotation: element.rotation,
      center: elementCenter(element),
    }
  }
  const bounds = selectionBounds(elements)
  if (!bounds) return null
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const rotation = sharedRotation(elements)
  if (rotation === null) return { bounds, rotation: 0, center }
  return tiltedFrame(elements, rotation, center)
}

function sharedRotation(elements: Element[]): number | null {
  const rotation = elements[0]?.rotation ?? 0
  if (Math.abs(rotation) < ROTATION_EPSILON) return null
  for (const element of elements) {
    if (!sameOrientation(element.rotation, rotation)) return null
  }
  return rotation
}

function sameOrientation(a: number, b: number): boolean {
  const diff = Math.abs(a - b) % FULL_TURN
  return Math.min(diff, FULL_TURN - diff) < ROTATION_EPSILON
}

function tiltedFrame(elements: Element[], rotation: number, pivot: Point): SelectionFrame {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const element of elements) {
    const local = rotatePoint(elementCenter(element), pivot, -rotation)
    minX = Math.min(minX, local.x - element.width / 2)
    minY = Math.min(minY, local.y - element.height / 2)
    maxX = Math.max(maxX, local.x + element.width / 2)
    maxY = Math.max(maxY, local.y + element.height / 2)
  }
  const width = maxX - minX
  const height = maxY - minY
  const center = rotatePoint({ x: minX + width / 2, y: minY + height / 2 }, pivot, rotation)
  return {
    bounds: { x: center.x - width / 2, y: center.y - height / 2, width, height },
    rotation,
    center,
  }
}

function rigidRotationFrame(before: Element[], after: Element[]): SelectionFrame | null {
  if (before.length < 2 || before.length !== after.length) return null
  const source = new Map(before.map((element) => [element.id, element]))
  let delta: number | null = null
  let beforeX = 0
  let beforeY = 0
  let afterX = 0
  let afterY = 0
  for (const element of after) {
    const original = source.get(element.id)
    if (!original) return null
    if (Math.abs(original.width - element.width) > SIZE_EPSILON) return null
    if (Math.abs(original.height - element.height) > SIZE_EPSILON) return null
    const spin = element.rotation - original.rotation
    if (delta === null) delta = spin
    else if (Math.abs(spin - delta) > ROTATION_EPSILON) return null
    const from = elementCenter(original)
    const to = elementCenter(element)
    beforeX += from.x
    beforeY += from.y
    afterX += to.x
    afterY += to.y
  }
  if (delta === null || Math.abs(delta) < ROTATION_EPSILON) return null
  const base = boundsFrame(before)
  if (!base) return null
  const count = after.length
  const pivot = { x: beforeX / count, y: beforeY / count }
  const spun = rotatePoint(base.center, pivot, delta)
  const center = {
    x: spun.x + afterX / count - pivot.x,
    y: spun.y + afterY / count - pivot.y,
  }
  return {
    bounds: {
      x: center.x - base.bounds.width / 2,
      y: center.y - base.bounds.height / 2,
      width: base.bounds.width,
      height: base.bounds.height,
    },
    rotation: base.rotation + delta,
    center,
  }
}
