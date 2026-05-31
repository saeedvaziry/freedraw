import type { Point } from '../model/types.js'

export function polylineMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0]! }

  let total = 0
  const segments: { from: Point; to: Point; length: number }[] = []
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1]!
    const to = points[i]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    segments.push({ from, to, length })
    total += length
  }
  if (total === 0) return { ...points[0]! }

  let remaining = total / 2
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const t = segment.length === 0 ? 0 : remaining / segment.length
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * t,
        y: segment.from.y + (segment.to.y - segment.from.y) * t,
      }
    }
    remaining -= segment.length
  }
  return { ...points[points.length - 1]! }
}
