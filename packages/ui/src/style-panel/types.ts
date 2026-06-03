export type StrokeStyle = 'solid' | 'dashed' | 'dotted'
export type TextAlign = 'left' | 'center' | 'right'
export type Arrowhead = 'none' | 'triangle' | 'dot' | 'bar'

export const MIXED = '__mixed__'

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
  textColor?: string
  textAlign?: TextAlign
}

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

export function pickValue<T extends string>(value: Mixed<T>): T | null {
  return value === MIXED ? null : (value as T)
}
