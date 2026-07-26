export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function intersects(a: Rect, b: Rect): boolean {
  if (a.x + a.width < b.x) return false
  if (b.x + b.width < a.x) return false
  if (a.y + a.height < b.y) return false
  if (b.y + b.height < a.y) return false
  return true
}

export function expand(r: Rect, amount: number): Rect {
  return {
    x: r.x - amount,
    y: r.y - amount,
    width: r.width + amount * 2,
    height: r.height + amount * 2,
  }
}

export function union(a: Rect, b: Rect): Rect {
  const minX = Math.min(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxX = Math.max(a.x + a.width, b.x + b.width)
  const maxY = Math.max(a.y + a.height, b.y + b.height)
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function pointRect(point: { x: number; y: number }, margin = 0): Rect {
  return { x: point.x - margin, y: point.y - margin, width: margin * 2, height: margin * 2 }
}
