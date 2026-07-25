import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../model/schema.js'
import type { Element, Point } from '../model/types.js'
import { selectionFrameFor } from './selection-frame.js'
import { selectionBounds } from './hit-test.js'
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
    expect(frame?.rotation).toBeCloseTo(0.8, 6)
  })
})

describe('selectionFrameFor once a multi-select rotation is committed', () => {
  const before = [rect('a', 0, 0), rect('b', 200, 0)]
  const origin = { x: 150, y: 50 }

  it('keeps the group orientation instead of popping to the axis-aligned box', () => {
    const spun = spinAround(before, origin, Math.PI / 2)
    const committed = selectionFrameFor(spun)
    expect(committed?.bounds.width).toBeCloseTo(300, 6)
    expect(committed?.bounds.height).toBeCloseTo(100, 6)
    expect(committed?.rotation).toBeCloseTo(Math.PI / 2, 6)
    closeTo(committed!.center, origin)
  })

  it('paints the committed frame exactly where the drag frame was', () => {
    for (const delta of [0.2, Math.PI / 4, Math.PI / 2, 2.4, -1.1]) {
      const spun = spinAround(before, origin, delta)
      const dragging = frameCorners(selectionFrameFor(spun, before)!)
      frameCorners(selectionFrameFor(spun)!).forEach((corner, index) =>
        closeTo(corner, dragging[index]!),
      )
    }
  })

  it('does not pop when the rotation happened about an off-centre origin', () => {
    const offOrigin = { x: -400, y: 260 }
    const spun = spinAround(before, offOrigin, 1.1)
    const dragging = frameCorners(selectionFrameFor(spun, before)!)
    frameCorners(selectionFrameFor(spun)!).forEach((corner, index) =>
      closeTo(corner, dragging[index]!),
    )
  })

  it('keeps stacking rotations on a group that already carries one', () => {
    const tilted = spinAround(before, origin, 0.5)
    const committed = selectionFrameFor(spinAround(tilted, origin, 0.3))
    expect(committed?.rotation).toBeCloseTo(0.8, 6)
    expect(committed?.bounds.width).toBeCloseTo(300, 6)
    expect(committed?.bounds.height).toBeCloseTo(100, 6)
  })

  it('wraps every shape in the tilted frame', () => {
    const spun = spinAround([rect('a', 0, 0), rect('b', 200, 40, 60, 200)], origin, 0.6)
    const frame = selectionFrameFor(spun)!
    for (const element of spun) {
      const local = rotatePoint(
        { x: element.x + element.width / 2, y: element.y + element.height / 2 },
        frame.center,
        -frame.rotation,
      )
      expect(local.x - element.width / 2).toBeGreaterThanOrEqual(frame.bounds.x - 1e-6)
      expect(local.y - element.height / 2).toBeGreaterThanOrEqual(frame.bounds.y - 1e-6)
      expect(local.x + element.width / 2).toBeLessThanOrEqual(frame.bounds.x + frame.bounds.width + 1e-6)
      expect(local.y + element.height / 2).toBeLessThanOrEqual(frame.bounds.y + frame.bounds.height + 1e-6)
    }
  })

  it('falls back to the axis-aligned box for a group with mixed rotations', () => {
    const mixed = [rect('a', 0, 0, 100, 100, 0.4), rect('b', 200, 0, 100, 100, 0.9)]
    const frame = selectionFrameFor(mixed)
    expect(frame?.rotation).toBe(0)
    expect(frame?.bounds).toEqual(selectionBounds(mixed))
  })
})

describe('selectionFrameFor falls back to the measured frame', () => {
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
    expect(selectionFrameFor(spun, [before[0]!, rect('c', 400, 0)])).toEqual(
      selectionFrameFor(spun),
    )
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
