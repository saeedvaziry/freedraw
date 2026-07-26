export type StrokeStyle = 'solid' | 'dashed' | 'dotted'
export type TextAlign = 'left' | 'center' | 'right'
export type FontStyle = 'normal' | 'italic'
export type Arrowhead = 'none' | 'triangle' | 'dot' | 'bar'

export const MIXED = '__mixed__'

export const FONT_WEIGHT_NORMAL = 400
export const FONT_WEIGHT_BOLD = 700
export const BOLD_THRESHOLD = 600

export type Mixed<T> = T | typeof MIXED

export interface PanelStyle {
  stroke: Mixed<string>
  fill: Mixed<string>
  strokeWidth: Mixed<number>
  strokeStyle: Mixed<StrokeStyle>
  opacity: Mixed<number>
  roundness: Mixed<number>
  sloppiness: Mixed<number>
  fontSize: Mixed<number>
  fontFamily: Mixed<string>
  fontWeight: Mixed<number>
  fontStyle: Mixed<FontStyle>
  textColor: Mixed<string>
  textAlign: Mixed<TextAlign>
}

export interface PanelStylePatch {
  stroke?: string
  fill?: string
  strokeWidth?: number
  strokeStyle?: StrokeStyle
  opacity?: number
  roundness?: number
  sloppiness?: number
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  fontStyle?: FontStyle
  textColor?: string
  textAlign?: TextAlign
}

export const COLOR_PATCH_KEYS = ['stroke', 'fill', 'textColor'] as const

export type ColorPatchKey = (typeof COLOR_PATCH_KEYS)[number]

export interface PanelPalette {
  recent: string[]
  document: string[]
}

export const EMPTY_PALETTE: PanelPalette = { recent: [], document: [] }

export interface ArrowPanelState {
  startArrowhead: Mixed<Arrowhead>
  endArrowhead: Mixed<Arrowhead>
}

export interface ArrowPanelPatch {
  startArrowhead?: Arrowhead
  endArrowhead?: Arrowhead
}

export function isMixed(value: Mixed<unknown>): boolean {
  return value === MIXED
}

export function resolveNumber(value: Mixed<number>, fallback: number): number {
  return value === MIXED ? fallback : value
}

export function resolveString<T extends string>(value: Mixed<T>, fallback: T): T {
  return value === MIXED ? fallback : (value as T)
}

export function pickValue<T extends string | number>(value: Mixed<T>): T | null {
  return value === MIXED ? null : (value as T)
}

export function isBoldWeight(value: Mixed<number>): boolean {
  return value !== MIXED && value >= BOLD_THRESHOLD
}
