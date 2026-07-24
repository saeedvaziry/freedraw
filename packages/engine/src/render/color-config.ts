export interface CanvasColors {
  gridLine: string
  gridMajor: string
  gridBackground: string
  selectionAccent: string
  selectionAccentSoft: string
  selectionHandle: string
}

export type CanvasColorOverrides = Partial<Record<keyof CanvasColors, string | null | undefined>>

export interface OverlayColors {
  accent: string
  accentSoft: string
  handle: string
}

export const DEFAULT_CANVAS_COLORS: CanvasColors = {
  gridLine: 'rgba(31, 41, 55, 0.035)',
  gridMajor: 'rgba(31, 41, 55, 0.09)',
  gridBackground: '#ffffff',
  selectionAccent: '#3b82f6',
  selectionAccentSoft: 'rgba(59, 130, 246, 0.15)',
  selectionHandle: '#ffffff',
}

const CANVAS_COLOR_KEYS = Object.keys(DEFAULT_CANVAS_COLORS) as (keyof CanvasColors)[]

export function resolveCanvasColors(overrides: CanvasColorOverrides = {}): CanvasColors {
  const resolved: CanvasColors = { ...DEFAULT_CANVAS_COLORS }
  for (const key of CANVAS_COLOR_KEYS) {
    const value = overrides[key]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed !== '') resolved[key] = trimmed
    }
  }
  return resolved
}

export function overlayColorsFrom(colors: CanvasColors): OverlayColors {
  return {
    accent: colors.selectionAccent,
    accentSoft: colors.selectionAccentSoft,
    handle: colors.selectionHandle,
  }
}
