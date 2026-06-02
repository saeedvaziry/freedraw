import { createId, pointsBounds } from '../model/factory.js'
import { selectionBounds } from '../geometry/hitTest.js'
import type {
  ArrowElement,
  Arrowhead,
  Binding,
  Element,
  ElementId,
  Point,
  SceneSnapshot,
  ShapeType,
  StrokeStyle,
} from '../model/types.js'

export const SCENE_CLIPBOARD_VERSION = 1

export interface SceneClipboardPayload {
  version: typeof SCENE_CLIPBOARD_VERSION
  id: string
  elements: Element[]
}

export interface SceneClipboardClone {
  elements: Element[]
  ids: ElementId[]
}

const SHAPE_TYPES = new Set<ShapeType>([
  'rect',
  'roundRect',
  'ellipse',
  'diamond',
  'triangle',
  'cylinder',
  'hexagon',
  'parallelogram',
  'star',
  'cloud',
  'heart',
])

const STROKE_STYLES = new Set<StrokeStyle>(['solid', 'dashed', 'dotted'])
const TEXT_ALIGNS = new Set(['left', 'center', 'right'])
const VERTICAL_ALIGNS = new Set(['top', 'middle', 'bottom'])
const ARROWHEADS = new Set<Arrowhead>(['none', 'triangle', 'dot', 'bar'])
const ROUTINGS = new Set<ArrowElement['routing']>(['straight', 'orthogonal', 'curved'])

export function createSceneClipboard(
  snapshot: SceneSnapshot,
  ids: Iterable<ElementId>,
): SceneClipboardPayload | null {
  const selected = selectedIds(snapshot, ids)
  if (selected.size === 0) return null
  const sourceIds = clipboardSourceIds(snapshot, selected)
  if (sourceIds.length === 0) return null
  return {
    version: SCENE_CLIPBOARD_VERSION,
    id: createId(),
    elements: sourceIds.map((id) => structuredClone(snapshot.elements[id]!)),
  }
}

export function cloneSceneClipboard(
  payload: SceneClipboardPayload,
  offset: Point,
): SceneClipboardClone {
  const idMap = new Map<ElementId, ElementId>()
  for (const element of payload.elements) idMap.set(element.id, createId())
  const elements = payload.elements.map((element) => cloneElement(element, idMap, offset))
  return { elements, ids: elements.map((element) => element.id) }
}

export function clipboardCenter(payload: SceneClipboardPayload): Point {
  const bounds = selectionBounds(payload.elements)
  if (!bounds) return { x: 0, y: 0 }
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

export function stringifySceneClipboard(payload: SceneClipboardPayload): string {
  return JSON.stringify(payload)
}

export function parseSceneClipboard(value: string): SceneClipboardPayload | null {
  if (value.trim().length === 0) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return isSceneClipboardPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function isSceneClipboardPayload(value: unknown): value is SceneClipboardPayload {
  if (!isObject(value)) return false
  if (value.version !== SCENE_CLIPBOARD_VERSION) return false
  if (typeof value.id !== 'string') return false
  if (!Array.isArray(value.elements) || value.elements.length === 0) return false
  const ids = new Set<ElementId>()
  for (const element of value.elements) {
    if (!isElement(element)) return false
    if (ids.has(element.id)) return false
    ids.add(element.id)
  }
  return true
}

function selectedIds(snapshot: SceneSnapshot, ids: Iterable<ElementId>): Set<ElementId> {
  const selected = new Set<ElementId>()
  for (const id of ids) {
    if (snapshot.elements[id]) selected.add(id)
  }
  return selected
}

function clipboardSourceIds(snapshot: SceneSnapshot, selected: Set<ElementId>): ElementId[] {
  const expanded = new Set(selected)
  for (const id of snapshot.order) {
    const element = snapshot.elements[id]
    if (!element || !isArrow(element) || expanded.has(id)) continue
    if (hasSelectedEndpoints(element, selected)) expanded.add(id)
  }
  return snapshot.order.filter((id) => expanded.has(id))
}

function hasSelectedEndpoints(element: ArrowElement, selected: Set<ElementId>): boolean {
  const startId = element.start?.elementId
  const endId = element.end?.elementId
  return Boolean(startId && endId && selected.has(startId) && selected.has(endId))
}

function cloneElement(
  element: Element,
  idMap: Map<ElementId, ElementId>,
  offset: Point,
): Element {
  if (isArrow(element)) return cloneArrow(element, idMap, offset)
  return {
    ...structuredClone(element),
    id: idMap.get(element.id)!,
    x: element.x + offset.x,
    y: element.y + offset.y,
  } as Element
}

function cloneArrow(
  element: ArrowElement,
  idMap: Map<ElementId, ElementId>,
  offset: Point,
): ArrowElement {
  const points = offsetPoints(element.points, offset)
  const route = offsetPoints(element.route, offset)
  return {
    ...structuredClone(element),
    id: idMap.get(element.id)!,
    ...pointsBounds(route.length > 0 ? route : points),
    points,
    route,
    start: cloneBinding(element.start, idMap),
    end: cloneBinding(element.end, idMap),
  }
}

function offsetPoints(points: Point[], offset: Point): Point[] {
  return points.map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }))
}

function cloneBinding(
  binding: Binding | undefined,
  idMap: Map<ElementId, ElementId>,
): Binding | undefined {
  if (!binding) return undefined
  const elementId = idMap.get(binding.elementId)
  if (!elementId) return undefined
  return { ...structuredClone(binding), elementId }
}

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow' || element.type === 'line'
}

function isElement(value: unknown): value is Element {
  if (!isBaseElement(value)) return false
  const type = value.type
  if (isShapeType(type)) return true
  if (type === 'sticky') return true
  if (type === 'text') return typeof value.text === 'string'
  if (type === 'freedraw') return isPointArray(value.points)
  if (type === 'image') return typeof value.assetId === 'string'
  if (type !== 'arrow' && type !== 'line') return false
  return (
    isPointArray(value.points) &&
    isPointArray(value.route) &&
    isOptionalBinding(value.start) &&
    isOptionalBinding(value.end) &&
    isArrowhead(value.startArrowhead) &&
    isArrowhead(value.endArrowhead) &&
    isRouting(value.routing)
  )
}

function isBaseElement(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.rotation) &&
    isStyle(value.style) &&
    isOptionalLabel(value.label)
  )
}

function isStyle(value: unknown): boolean {
  if (!isObject(value)) return false
  return (
    typeof value.stroke === 'string' &&
    typeof value.fill === 'string' &&
    isFiniteNumber(value.strokeWidth) &&
    isStrokeStyle(value.strokeStyle) &&
    isFiniteNumber(value.opacity) &&
    isFiniteNumber(value.roundness) &&
    isFiniteNumber(value.fontSize) &&
    typeof value.fontFamily === 'string' &&
    typeof value.textColor === 'string' &&
    isTextAlign(value.textAlign)
  )
}

function isOptionalLabel(value: unknown): boolean {
  if (value === undefined) return true
  if (!isObject(value)) return false
  return (
    typeof value.text === 'string' &&
    isTextAlign(value.align) &&
    isVerticalAlign(value.verticalAlign)
  )
}

function isOptionalBinding(value: unknown): value is Binding | undefined {
  if (value === undefined) return true
  if (!isObject(value)) return false
  if (typeof value.elementId !== 'string') return false
  if (!isObject(value.anchor)) return false
  return isFiniteNumber(value.anchor.nx) && isFiniteNumber(value.anchor.ny) && isFiniteNumber(value.gap)
}

function isPointArray(value: unknown): value is Point[] {
  return Array.isArray(value) && value.every(isPoint)
}

function isPoint(value: unknown): value is Point {
  return isObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isShapeType(value: unknown): value is ShapeType {
  return typeof value === 'string' && SHAPE_TYPES.has(value as ShapeType)
}

function isStrokeStyle(value: unknown): value is StrokeStyle {
  return typeof value === 'string' && STROKE_STYLES.has(value as StrokeStyle)
}

function isTextAlign(value: unknown): boolean {
  return typeof value === 'string' && TEXT_ALIGNS.has(value)
}

function isVerticalAlign(value: unknown): boolean {
  return typeof value === 'string' && VERTICAL_ALIGNS.has(value)
}

function isArrowhead(value: unknown): value is Arrowhead {
  return typeof value === 'string' && ARROWHEADS.has(value as Arrowhead)
}

function isRouting(value: unknown): value is ArrowElement['routing'] {
  return typeof value === 'string' && ROUTINGS.has(value as ArrowElement['routing'])
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
