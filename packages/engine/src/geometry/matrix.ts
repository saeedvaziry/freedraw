export interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export function identity(): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

export function scaleTranslate(scale: number, tx: number, ty: number): Matrix {
  return { a: scale, b: 0, c: 0, d: scale, e: tx, f: ty }
}
