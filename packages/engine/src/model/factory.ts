import { defaultStyle } from './schema.js'
import type {
  Arrowhead,
  ArrowElement,
  Binding,
  ElementId,
  ImageElement,
  Point,
  ShapeElement,
  ShapeType,
  StickyElement,
  Style,
  TextElement,
} from './types.js'

let counter = 0

export function createId(): ElementId {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  counter += 1
  return `el_${counter}`
}

export interface ShapeInit {
  id?: ElementId
  type?: ShapeType
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  style?: Partial<Style>
}

export function createShape(init: ShapeInit): ShapeElement {
  return {
    id: init.id ?? createId(),
    type: init.type ?? 'rect',
    x: init.x,
    y: init.y,
    width: init.width,
    height: init.height,
    rotation: init.rotation ?? 0,
    style: { ...defaultStyle, ...init.style },
  }
}

export interface TextInit {
  id?: ElementId
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  style?: Partial<Style>
}

export const TEXT_DEFAULT_WIDTH = 160
export const TEXT_DEFAULT_HEIGHT = 24

export function createText(init: TextInit): TextElement {
  return {
    id: init.id ?? createId(),
    type: 'text',
    x: init.x,
    y: init.y,
    width: init.width ?? TEXT_DEFAULT_WIDTH,
    height: init.height ?? TEXT_DEFAULT_HEIGHT,
    rotation: 0,
    style: { ...defaultStyle, textAlign: 'center', ...init.style },
    text: init.text ?? '',
  }
}

export const STICKY_DEFAULT_WIDTH = 160
export const STICKY_DEFAULT_HEIGHT = 120
export const STICKY_FILL = '#fef08a'
export const STICKY_STROKE = '#eab308'
export const STICKY_ROUNDNESS = 12

export interface StickyInit {
  id?: ElementId
  x: number
  y: number
  width?: number
  height?: number
  style?: Partial<Style>
}

export function createSticky(init: StickyInit): StickyElement {
  return {
    id: init.id ?? createId(),
    type: 'sticky',
    x: init.x,
    y: init.y,
    width: init.width ?? STICKY_DEFAULT_WIDTH,
    height: init.height ?? STICKY_DEFAULT_HEIGHT,
    rotation: 0,
    style: {
      ...defaultStyle,
      fill: STICKY_FILL,
      stroke: STICKY_STROKE,
      roundness: STICKY_ROUNDNESS,
      textAlign: 'center',
      ...init.style,
    },
  }
}

export const IMAGE_VIEWPORT_MARGIN = 0.8

export interface ImageInit {
  id?: ElementId
  assetId: string
  x: number
  y: number
  naturalWidth: number
  naturalHeight: number
  viewportWidth: number
  viewportHeight: number
  style?: Partial<Style>
}

export function fitToViewport(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const maxWidth = viewportWidth * IMAGE_VIEWPORT_MARGIN
  const maxHeight = viewportHeight * IMAGE_VIEWPORT_MARGIN
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight)
  return { width: naturalWidth * scale, height: naturalHeight * scale }
}

export function createImage(init: ImageInit): ImageElement {
  const { width, height } = fitToViewport(
    init.naturalWidth,
    init.naturalHeight,
    init.viewportWidth,
    init.viewportHeight,
  )
  return {
    id: init.id ?? createId(),
    type: 'image',
    x: init.x,
    y: init.y,
    width,
    height,
    rotation: 0,
    style: { ...defaultStyle, ...init.style },
    assetId: init.assetId,
  }
}

export function pointsBounds(points: Point[]): {
  x: number
  y: number
  width: number
  height: number
} {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export interface ArrowInit {
  id?: ElementId
  type?: 'arrow' | 'line'
  points: Point[]
  start?: Binding
  end?: Binding
  startArrowhead?: Arrowhead
  endArrowhead?: Arrowhead
  routing?: ArrowElement['routing']
  style?: Partial<Style>
}

export function createArrow(init: ArrowInit): ArrowElement {
  const type = init.type ?? 'arrow'
  return {
    id: init.id ?? createId(),
    type,
    ...pointsBounds(init.points),
    rotation: 0,
    style: { ...defaultStyle, ...init.style },
    points: init.points,
    start: init.start,
    end: init.end,
    startArrowhead: init.startArrowhead ?? 'none',
    endArrowhead: init.endArrowhead ?? (type === 'arrow' ? 'triangle' : 'none'),
    routing: init.routing ?? 'straight',
  }
}
