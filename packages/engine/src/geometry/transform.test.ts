import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../model/schema.js'
import type { Element, Point } from '../model/types.js'
import type { Rect } from './rect.js'
import type { SelectionFrame } from './handles.js'
import { rotatePoint } from './rotate.js'
import { resizeElements, resizedBounds } from './transform.js'

function rect(id: string, x: number, y: number, width: number, height: number, rotation = 0): Element {
  return { id, type: 'rect', x, y, width, height, rotation, style: { ...defaultStyle } }
}

function labeledRect(): Element {
  return {
    id: 'r1',
    type: 'rect',
    x: 0,
    y: 0,
    width: 300,
    height: 80,
    rotation: 0,
    style: { ...defaultStyle },
    label: { text: 'hi', align: 'center', verticalAlign: 'middle', baseWidth: 120, baseHeight: 80 },
  }
}

function freedraw(x: number, y: number, width: number, height: number, rotation: number): Element {
  return {
    id: 'f1',
    type: 'freedraw',
    x,
    y,
    width,
    height,
    rotation,
    style: { ...defaultStyle },
    points: [
      { x, y },
      { x: x + width, y: y + height },
    ],
  }
}

function applied(element: Element, patch: Partial<Element>): Element {
  return { ...element, ...patch } as Element
}

function corners(bounds: Rect): Point[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]
}

function worldCorners(element: Element): Point[] {
  const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
  return corners({ x: element.x, y: element.y, width: element.width, height: element.height }).map(
    (corner) => rotatePoint(corner, center, element.rotation),
  )
}

function frameQuad(bounds: Rect, pivot: Point, rotation: number): Point[] {
  return corners(bounds).map((corner) => rotatePoint(corner, pivot, rotation))
}

function closeTo(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
}

function tiltedPair(rotation: number): { frame: SelectionFrame; elements: Element[] } {
  const pivot = { x: 150, y: 50 }
  const elements = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ].map((origin, index) => {
    const center = rotatePoint({ x: origin.x + 50, y: origin.y + 50 }, pivot, rotation)
    return rect(index === 0 ? 'a' : 'b', center.x - 50, center.y - 50, 100, 100, rotation)
  })
  return {
    frame: { bounds: { x: 0, y: 0, width: 300, height: 100 }, rotation, center: pivot },
    elements,
  }
}

describe('resizeElements against an axis-aligned frame', () => {
  it('scales each element against the frame origin in world space', () => {
    const frame: SelectionFrame = {
      bounds: { x: 0, y: 0, width: 300, height: 100 },
      rotation: 0,
      center: { x: 150, y: 50 },
    }
    const patches = resizeElements(
      [rect('a', 0, 0, 100, 100), rect('b', 200, 0, 100, 100)],
      frame,
      { x: 10, y: 20, width: 600, height: 200 },
    )
    expect(patches[0]!.patch).toEqual({ x: 10, y: 20, width: 200, height: 200 })
    expect(patches[1]!.patch).toEqual({ x: 410, y: 20, width: 200, height: 200 })
  })

  it('anchors freedraw points to the resized origin', () => {
    const element = freedraw(0, 0, 100, 100, 0)
    const frame: SelectionFrame = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      rotation: 0,
      center: { x: 50, y: 50 },
    }
    const patch = resizeElements([element], frame, { x: 40, y: 40, width: 200, height: 200 })[0]!.patch
    expect(patch.x).toBe(40)
    expect((patch as { points: Point[] }).points).toEqual([
      { x: 40, y: 40 },
      { x: 240, y: 240 },
    ])
  })
})

describe('resizeElements label floor', () => {
  it('adopts the resized size as the new label floor', () => {
    const element = labeledRect()
    const frame = { bounds: { x: 0, y: 0, width: 300, height: 80 }, rotation: 0, center: { x: 150, y: 40 } }
    const result = resizeElements([element], frame, { x: 0, y: 0, width: 600, height: 160 })[0]!
    expect(result.patch.width).toBe(600)
    expect(result.patch.label?.baseWidth).toBe(600)
    expect(result.patch.label?.baseHeight).toBe(160)
  })

  it('leaves elements without a stored floor untouched', () => {
    const element = labeledRect()
    element.label = { text: 'hi', align: 'center', verticalAlign: 'middle' }
    const frame = { bounds: { x: 0, y: 0, width: 300, height: 80 }, rotation: 0, center: { x: 150, y: 40 } }
    const result = resizeElements([element], frame, { x: 0, y: 0, width: 600, height: 160 })[0]!
    expect(result.patch.label).toBeUndefined()
  })
})

describe('resizeElements against a rotated frame', () => {
  it('pins the opposite edge in world space for any frame rotation', () => {
    for (const rotation of [0, 0.3, Math.PI / 2, 2.1, -0.8]) {
      const element = rect('a', 0, 0, 100, 100, rotation)
      const frame: SelectionFrame = {
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        rotation,
        center: { x: 50, y: 50 },
      }
      const before = worldCorners(element)
      const pointer = rotatePoint({ x: 150, y: 50 }, frame.center, rotation)
      const next = resizedBounds(frame, 'e', pointer)
      expect(next.x).toBeCloseTo(0, 6)
      expect(next.width).toBeCloseTo(150, 6)
      const patch = resizeElements([element], frame, next)[0]!.patch
      expect(patch.width).toBeCloseTo(150, 6)
      expect(patch.height).toBeCloseTo(100, 6)
      const after = worldCorners(applied(element, patch))
      closeTo(after[0]!, before[0]!)
      closeTo(after[3]!, before[3]!)
    }
  })

  it('places a rotated element on the world quad the frame-local rect describes', () => {
    const rotation = 0.9
    const element = rect('a', 0, 0, 100, 60, rotation)
    const frame: SelectionFrame = {
      bounds: { x: 0, y: 0, width: 100, height: 60 },
      rotation,
      center: { x: 50, y: 30 },
    }
    const next = { x: -20, y: 10, width: 260, height: 30 }
    const patch = resizeElements([element], frame, next)[0]!.patch
    const expected = frameQuad(next, frame.center, rotation)
    worldCorners(applied(element, patch)).forEach((corner, index) => closeTo(corner, expected[index]!))
  })

  it('scales a tilted group along the frame axes rather than the world axes', () => {
    const rotation = 0.7
    const { frame, elements } = tiltedPair(rotation)
    const patches = resizeElements(elements, frame, { x: 0, y: 0, width: 600, height: 100 })

    expect(patches[0]!.patch.width).toBeCloseTo(200, 6)
    expect(patches[1]!.patch.width).toBeCloseTo(200, 6)
    expect(patches[0]!.patch.height).toBeCloseTo(100, 6)

    const expectedA = frameQuad({ x: 0, y: 0, width: 200, height: 100 }, frame.center, rotation)
    const expectedB = frameQuad({ x: 400, y: 0, width: 200, height: 100 }, frame.center, rotation)
    worldCorners(applied(elements[0]!, patches[0]!.patch)).forEach((corner, index) =>
      closeTo(corner, expectedA[index]!),
    )
    worldCorners(applied(elements[1]!, patches[1]!.patch)).forEach((corner, index) =>
      closeTo(corner, expectedB[index]!),
    )
  })

  it('keeps a tilted group anchored on the handle opposite the drag', () => {
    const rotation = -1.2
    const { frame, elements } = tiltedPair(rotation)
    const before = worldCorners(elements[0]!)
    const pointer = rotatePoint({ x: 600, y: 50 }, frame.center, rotation)
    const next = resizedBounds(frame, 'e', pointer)
    expect(next.width).toBeCloseTo(600, 6)
    const patches = resizeElements(elements, frame, next)
    const after = worldCorners(applied(elements[0]!, patches[0]!.patch))
    closeTo(after[0]!, before[0]!)
    closeTo(after[3]!, before[3]!)
  })

  it('carries freedraw points through the rotated placement', () => {
    const rotation = 1.4
    const element = freedraw(0, 0, 100, 100, rotation)
    const frame: SelectionFrame = {
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      rotation,
      center: { x: 50, y: 50 },
    }
    const patch = resizeElements([element], frame, { x: 0, y: 0, width: 200, height: 200 })[0]!.patch
    const points = (patch as { points: Point[] }).points
    closeTo(points[0]!, { x: patch.x!, y: patch.y! })
    closeTo(points[1]!, { x: patch.x! + 200, y: patch.y! + 200 })
  })
})
