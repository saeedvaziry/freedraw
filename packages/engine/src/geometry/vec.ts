export interface Vec {
  x: number
  y: number
}

export function vec(x: number, y: number): Vec {
  return { x, y }
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s }
}
