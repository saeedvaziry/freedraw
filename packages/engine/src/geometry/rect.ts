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
