import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/camera.js'
import type { SnapGuide } from '../../geometry/snap.js'
import type { Point } from '../../model/types.js'
import { paintGuides } from './guides.js'

interface RecordedCap {
  from: Point
  to: Point
}

function recorder(): { ctx: CanvasRenderingContext2D; caps: RecordedCap[] } {
  const caps: RecordedCap[] = []
  let pending: Point | null = null
  const noop = (): void => {}
  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: noop,
    restore: noop,
    setLineDash: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    fillText: noop,
    measureText: () => ({ width: 20 }),
    moveTo: (x: number, y: number) => {
      pending = { x, y }
    },
    lineTo: (x: number, y: number) => {
      if (pending) caps.push({ from: pending, to: { x, y } })
      pending = null
    },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, caps }
}

const camera = new Camera({ x: 0, y: 0, zoom: 1 })

function distanceGuide(from: Point, to: Point): SnapGuide {
  return { kind: 'distance', from, to, label: 40 }
}

function capsOf(from: Point, to: Point): RecordedCap[] {
  const { ctx, caps } = recorder()
  paintGuides(ctx, [distanceGuide(from, to)], camera)
  return caps.slice(1)
}

function directionOf(cap: RecordedCap): Point {
  const dx = cap.to.x - cap.from.x
  const dy = cap.to.y - cap.from.y
  const length = Math.hypot(dx, dy)
  return { x: dx / length, y: dy / length }
}

describe('paintGuides distance caps', () => {
  it('draws a cap at each end of the distance segment', () => {
    expect(capsOf({ x: 0, y: 0 }, { x: 100, y: 0 })).toHaveLength(2)
  })

  it('keeps horizontal caps vertical and exactly four pixels each side', () => {
    expect(capsOf({ x: 20, y: 50 }, { x: 120, y: 50 })).toEqual([
      { from: { x: 20, y: 46 }, to: { x: 20, y: 54 } },
      { from: { x: 120, y: 46 }, to: { x: 120, y: 54 } },
    ])
  })

  it('keeps vertical caps horizontal and exactly four pixels each side', () => {
    const caps = capsOf({ x: 50, y: 20 }, { x: 50, y: 120 })
    expect(caps.map((cap) => [cap.from.y, cap.to.y])).toEqual([
      [20, 20],
      [120, 120],
    ])
    expect(caps.map((cap) => [cap.from.x, cap.to.x].sort((a, b) => a - b))).toEqual([
      [46, 54],
      [46, 54],
    ])
  })

  it('rotates the caps perpendicular to a tilted segment', () => {
    const caps = capsOf({ x: 0, y: 0 }, { x: 100, y: 100 })
    for (const cap of caps) {
      const direction = directionOf(cap)
      expect(direction.x * 1 + direction.y * 1).toBeCloseTo(0)
      expect(Math.hypot(cap.to.x - cap.from.x, cap.to.y - cap.from.y)).toBeCloseTo(8)
    }
  })

  it('centres each tilted cap on its own segment endpoint', () => {
    const caps = capsOf({ x: 0, y: 0 }, { x: 100, y: 100 })
    expect(caps[0]!.from.x + caps[0]!.to.x).toBeCloseTo(0)
    expect(caps[0]!.from.y + caps[0]!.to.y).toBeCloseTo(0)
    expect(caps[1]!.from.x + caps[1]!.to.x).toBeCloseTo(200)
    expect(caps[1]!.from.y + caps[1]!.to.y).toBeCloseTo(200)
  })

  it('stays perpendicular on a shallow tilt that a dominant-axis branch would call horizontal', () => {
    const to = { x: 100, y: 20 }
    const caps = capsOf({ x: 0, y: 0 }, to)
    const direction = directionOf(caps[0]!)
    expect(direction.x * to.x + direction.y * to.y).toBeCloseTo(0)
  })

  it('emits finite cap endpoints for a zero-length segment', () => {
    const caps = capsOf({ x: 30, y: 30 }, { x: 30, y: 30 })
    expect(caps).toEqual([
      { from: { x: 30, y: 26 }, to: { x: 30, y: 34 } },
      { from: { x: 30, y: 26 }, to: { x: 30, y: 34 } },
    ])
  })
})
