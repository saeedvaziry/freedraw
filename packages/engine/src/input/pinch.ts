import type { Point } from '../model/types.js'

export interface PinchSample {
  center: Point
  distance: number
}

export interface PinchDelta {
  center: Point
  panX: number
  panY: number
  scale: number
}

export function pinchSample(a: Point, b: Point): PinchSample {
  return {
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.hypot(a.x - b.x, a.y - b.y),
  }
}

export function pinchDelta(previous: PinchSample, next: PinchSample): PinchDelta {
  return {
    center: next.center,
    panX: next.center.x - previous.center.x,
    panY: next.center.y - previous.center.y,
    scale: previous.distance === 0 ? 1 : next.distance / previous.distance,
  }
}
