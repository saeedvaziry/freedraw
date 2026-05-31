import type { StrokeStyle } from '../../model/types.js'

const DASH_PATTERNS: Record<StrokeStyle, number[]> = {
  solid: [],
  dashed: [10, 6],
  dotted: [2, 6],
}

export function dashPattern(strokeStyle: StrokeStyle): number[] {
  return DASH_PATTERNS[strokeStyle] ?? []
}
