import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../model/schema.js'
import type { Element, Point } from '../model/types.js'
import { selectionFrameFor } from './selection-frame.js'
import { rotatePoint } from './rotate.js'
import type { SelectionFrame } from './handles.js'

function rect(id: string, x: number, y: number, width = 100, height = 100, rotation = 0): Element {
  return { id, type: 'rect', x, y, width, height, rotation, style: { ...defaultStyle } }
}

function spinAround(elements: Element[], origin: Point, delta: number): Element[] {
  return elements.map((element) => {
    const center = rotatePoint(
      { x: element.x + element.width / 2, y: element.y + element.height / 2 },
      origin,
      delta,
    )
    return {
      ...element,
      x: center.x - element.width / 2,
      y: center.y - element.height / 2,
      rotation: element.rotation + delta,
    }
  })
}

function frameCorners(frame: SelectionFrame): Point[] {
  const { bounds, center, rotation } = frame
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((corner) => rotatePoint(corner, center, rotation))
}

function closeTo(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
}

describe('selectionFrameFor without a pre-transform selection', () => {
  it('returns the element bounds and rotation for a single element', () => {
    const element = rect('a', 10, 20, 120, 80, 0.4)
    const frame = selectionFrameFor([element])
    expect(frame).toEqual({
      bounds: { x: 10, y: 20, width: 120, height: 80 },
      rotation: 0.4,
      center: { x: 70, y: 60 },
    })
  })

  it('returns an axis-aligned frame for a multi selection', () => {
    const frame = selectionFrameFor([rect('a', 0, 0), rect('b', 200, 0)])
    expect(frame).toEqual({
      bounds: { x: 0, y: 0, width: 300, height: 100 },
      rotation: 0,
      center: { x: 150, y: 50 },
    })
  })

  it('returns null for an empty selection', () => {
    expect(selectionFrameFor([])).toBeNull()
  })
})

describe('selectionFrameFor during a multi-select rotation', () => {
  const before = [rect('a', 0, 0), rect('b', 200, 0)]
  const origin = { x: 150, y: 50 }

  it('keeps the frame rigid while the selection spins', () => {
    for (const delta of [0.2, Math.PI / 4, Math.PI / 2, 2.4, -1.1]) {
      const frame = selectionFrameFor(spinAround(before, origin, delta), before)
      expect(frame?.bounds.width).toBeCloseTo(300, 6)
      expect(frame?.bounds.height).toBeCloseTo(100, 6)
      expect(frame?.rotation).toBeCloseTo(delta, 6)
      closeTo(frame!.center, origin)
    }
  })

  it('tracks a rotation about an origin that is not the selection center', () => {
    const offOrigin = { x: 0, y: 0 }
    const delta = Math.PI / 3
    const frame = selectionFrameFor(spinAround(before, offOrigin, delta), before)
    expect(frame?.bounds.width).toBeCloseTo(300, 6)
    expect(frame?.bounds.height).toBeCloseTo(100, 6)
    expect(frame?.rotation).toBeCloseTo(delta, 6)
    closeTo(frame!.center, rotatePoint(origin, offOrigin, delta))
  })

  it('paints the frame over the rigidly rotated original quad', () => {
    const delta = 0.9
    const base = selectionFrameFor(before)!
    const frame = selectionFrameFor(spinAround(before, origin, delta), before)!
    const expected = frameCorners(base).map((corner) => rotatePoint(corner, origin, delta))
    frameCorners(frame).forEach((corner, index) => closeTo(corner, expected[index]!))
  })

  it('stays rigid when the selection already carries a rotation', () => {
    const tilted = [rect('a', 0, 0, 100, 100, 0.5), rect('b', 200, 0, 100, 100, 0.5)]
    const frame = selectionFrameFor(spinAround(tilted, origin, 0.3), tilted)
    expect(frame?.bounds.width).toBeCloseTo(selectionFrameFor(tilted)!.bounds.width, 6)
    expect(frame?.rotation).toBeCloseTo(0.3, 6)
  })

  it('grows the axis-aligned box once the rotation is committed', () => {
    const spun = spinAround(before, origin, Math.PI / 2)
    const committed = selectionFrameFor(spun)
    expect(committed?.bounds.width).toBeCloseTo(100, 6)
    expect(committed?.bounds.height).toBeCloseTo(300, 6)
    expect(committed?.rotation).toBe(0)
  })
})

describe('selectionFrameFor falls back to the axis-aligned frame', () => {
  const before = [rect('a', 0, 0), rect('b', 200, 0)]

  it('for a move preview', () => {
    const moved = before.map((element) => ({ ...element, x: element.x + 40 }))
    expect(selectionFrameFor(moved, before)).toEqual({
      bounds: { x: 40, y: 0, width: 300, height: 100 },
      rotation: 0,
      center: { x: 190, y: 50 },
    })
  })

  it('for a resize preview', () => {
    const resized = before.map((element) => ({ ...element, width: element.width * 2 }))
    expect(selectionFrameFor(resized, before)?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 100,
    })
  })

  it('when the elements do not share a rotation delta', () => {
    const mixed = [{ ...before[0]!, rotation: 0.4 }, before[1]!]
    expect(selectionFrameFor(mixed, before)?.rotation).toBe(0)
  })

  it('when a previewed element has no committed counterpart', () => {
    const spun = spinAround(before, { x: 150, y: 50 }, 0.5)
    expect(selectionFrameFor(spun, [before[0]!, rect('c', 400, 0)])?.rotation).toBe(0)
  })

  it('for a single rotating element, whose own rotation already drives the frame', () => {
    const element = rect('a', 0, 0, 120, 80)
    const spun = [{ ...element, rotation: 0.7 }]
    expect(selectionFrameFor(spun, [element])).toEqual({
      bounds: { x: 0, y: 0, width: 120, height: 80 },
      rotation: 0.7,
      center: { x: 60, y: 40 },
    })
  })
})
