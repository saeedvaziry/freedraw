export type ElementId = string

export type StrokeStyle = 'solid' | 'dashed' | 'dotted'

export interface Point {
  x: number
  y: number
}

export interface Style {
  stroke: string
  fill: string
  strokeWidth: number
  strokeStyle: StrokeStyle
  opacity: number
  roundness: number
  sloppiness: number
  fontSize: number
  fontFamily: string
  textColor: string
  textAlign: 'left' | 'center' | 'right'
}

export interface Label {
  text: string
  align: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
}

export interface BaseElement {
  id: ElementId
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  style: Style
  label?: Label
}

export type ShapeType =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'cylinder'
  | 'hexagon'
  | 'parallelogram'
  | 'star'
  | 'cloud'
  | 'heart'

export interface ShapeElement extends BaseElement {
  type: ShapeType
}

export interface StickyElement extends BaseElement {
  type: 'sticky'
}

export interface TextElement extends BaseElement {
  type: 'text'
  text: string
}

export interface FreedrawElement extends BaseElement {
  type: 'freedraw'
  points: Point[]
}

export interface ImageElement extends BaseElement {
  type: 'image'
  assetId: string
}

export type Arrowhead = 'none' | 'triangle' | 'dot' | 'bar'

export interface Binding {
  elementId: ElementId
  anchor: { nx: number; ny: number }
  gap: number
}

export interface ArrowElement extends BaseElement {
  type: 'arrow' | 'line'
  points: Point[]
  route: Point[]
  start?: Binding
  end?: Binding
  startArrowhead: Arrowhead
  endArrowhead: Arrowhead
  routing: 'straight' | 'orthogonal' | 'curved'
}

export type Element =
  | ShapeElement
  | StickyElement
  | TextElement
  | FreedrawElement
  | ImageElement
  | ArrowElement

export interface CameraState {
  x: number
  y: number
  zoom: number
}

export interface AppState {
  schemaVersion: number
  camera: CameraState
  lastUsedStyle: Style
}

export interface SceneSnapshot {
  elements: Record<ElementId, Element>
  order: ElementId[]
  appState: AppState
}
