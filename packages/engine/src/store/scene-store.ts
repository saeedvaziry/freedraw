import * as Y from 'yjs'
import { createId, DEFAULT_STICKY_COLOR, pointsBounds, type StickyColor } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import { defaultAppState } from '../model/schema.js'
import { rotatedBounds } from '../geometry/rotate.js'
import type { Rect } from '../geometry/rect.js'
import {
  alignDeltas,
  distributeDeltas,
  type AlignEdge,
  type ArrangeDelta,
  type ArrangeTarget,
  type DistributeAxis,
} from '../geometry/arrange.js'
import type {
  AppState,
  ArrowElement,
  CameraState,
  Element,
  ElementId,
  Point,
  SceneSnapshot,
  ShapeType,
  Slide,
  Style,
  TextElement,
} from '../model/types.js'
import {
  clipboardCenter,
  cloneSceneClipboard,
  createSceneClipboard,
  type SceneClipboardPayload,
} from './clipboard.js'
import type { Stencil } from './stencil.js'
import { HoverStore } from './hover-store.js'
import { RouteCache } from './route-cache.js'
import { deriveSelectionStyle, type SelectionStyle } from './selection-style.js'
import { measureTextBox } from '../text/size.js'

const DUPLICATE_OFFSET = 16
const DUPLICATE_OFFSET_POINT = { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET }

function affectsTextSize(patch: Partial<Style>): boolean {
  return patch.fontSize !== undefined || patch.fontFamily !== undefined
}

function shallowEqualStyle(a: SelectionStyle, b: SelectionStyle): boolean {
  return (Object.keys(a) as (keyof SelectionStyle)[]).every((key) => a[key] === b[key])
}

function pasteOffsetForTarget(payload: SceneClipboardPayload, target: Point): Point {
  const center = clipboardCenter(payload)
  return { x: target.x - center.x, y: target.y - center.y }
}

function stencilTargetPoint(target: Point | Rect): Point {
  return 'width' in target
    ? { x: target.x + target.width / 2, y: target.y + target.height / 2 }
    : target
}

export const TRANSACTION_ORIGIN = 'freedraw'

export interface TransactionApi {
  addElement(element: Element): void
  updateElement(id: ElementId, patch: Partial<Element>): void
  removeElement(id: ElementId): void
  removeElements(ids: ElementId[]): void
  reorder(order: ElementId[]): void
}

export interface PasteElementsOptions {
  payload?: SceneClipboardPayload | null
  target?: Point | null
}

export type ToolId =
  | 'select'
  | 'hand'
  | 'arrow'
  | 'line'
  | 'text'
  | 'sticky'
  | 'image'
  | 'freedraw'
  | 'shape'

export interface UiState {
  selectedIds: Set<ElementId>
  activeTool: ToolId
  activeShapeType: ShapeType
  activeStickyColor: StickyColor
  clipboardElementCount: number
  toolLock: boolean
}

export type StoreChannel = 'doc' | 'selection' | 'chrome' | 'hover' | 'local' | 'history'

export interface StoreSelector<T> {
  subscribe(cb: () => void): () => void
  getSnapshot(): T
}

export interface SelectOptions<T> {
  equals?: (a: T, b: T) => boolean
  channels?: readonly StoreChannel[]
}

const DEFAULT_SELECT_CHANNELS: readonly StoreChannel[] = ['doc', 'selection', 'chrome', 'local', 'history']

export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  const bRecord = b as Record<string, unknown>
  for (const key of aKeys) {
    if (!Object.hasOwn(bRecord, key)) return false
    if (!Object.is((a as Record<string, unknown>)[key], bRecord[key])) return false
  }
  return true
}

export interface LocalAppState {
  camera: CameraState
  lastUsedStyle: Style
  snapGuidesEnabled: boolean
}

type Subscriber = () => void

function readLocalAppState(yAppState: Y.Map<unknown>): LocalAppState {
  const fallback = defaultAppState()
  const json = yAppState.toJSON() as Partial<AppState>
  return {
    camera: json.camera ?? fallback.camera,
    lastUsedStyle: json.lastUsedStyle ?? fallback.lastUsedStyle,
    snapGuidesEnabled:
      typeof json.snapGuidesEnabled === 'boolean' ? json.snapGuidesEnabled : fallback.snapGuidesEnabled,
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toSlide(value: unknown): Slide | null {
  if (typeof value !== 'object' || value === null) return null
  const slide = value as Record<string, unknown>
  const rect = slide.rect
  if (typeof rect !== 'object' || rect === null) return null
  const bounds = rect as Record<string, unknown>
  if (
    typeof slide.id !== 'string' ||
    typeof slide.name !== 'string' ||
    !isFiniteNumber(slide.order) ||
    !isFiniteNumber(bounds.x) ||
    !isFiniteNumber(bounds.y) ||
    !isFiniteNumber(bounds.width) ||
    !isFiniteNumber(bounds.height)
  ) {
    return null
  }
  return {
    id: slide.id,
    name: slide.name,
    rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    order: slide.order,
  }
}

function toSlides(value: unknown): Slide[] {
  if (!Array.isArray(value)) return []
  const slides: Slide[] = []
  for (const item of value) {
    const slide = toSlide(item)
    if (slide) slides.push(slide)
  }
  return slides
}

function toYElement(element: Element): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [key, value] of Object.entries(element)) {
    if (isArrowElement(element) && key === 'route') continue
    map.set(key, value)
  }
  return map
}

function fromYElement(map: Y.Map<unknown>): Element {
  return map.toJSON() as Element
}

function moveToFront(order: ElementId[], ids: ElementId[]): ElementId[] {
  const set = new Set(ids)
  return [...order.filter((id) => !set.has(id)), ...order.filter((id) => set.has(id))]
}

function moveToBack(order: ElementId[], ids: ElementId[]): ElementId[] {
  const set = new Set(ids)
  return [...order.filter((id) => set.has(id)), ...order.filter((id) => !set.has(id))]
}

function moveForward(order: ElementId[], ids: ElementId[]): ElementId[] {
  const set = new Set(ids)
  const result = [...order]
  for (let i = result.length - 2; i >= 0; i -= 1) {
    if (set.has(result[i]!) && !set.has(result[i + 1]!)) {
      const swap = result[i]!
      result[i] = result[i + 1]!
      result[i + 1] = swap
    }
  }
  return result
}

function moveBackward(order: ElementId[], ids: ElementId[]): ElementId[] {
  const set = new Set(ids)
  const result = [...order]
  for (let i = 1; i < result.length; i += 1) {
    if (set.has(result[i]!) && !set.has(result[i - 1]!)) {
      const swap = result[i]!
      result[i] = result[i - 1]!
      result[i - 1] = swap
    }
  }
  return result
}

function sameOrder(a: ElementId[], b: ElementId[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function translatedPatch(element: Element, dx: number, dy: number): Partial<Element> {
  if (isArrowElement(element) || element.type === 'freedraw') {
    const points = element.points.map((point) => ({ x: point.x + dx, y: point.y + dy }))
    return { points, ...pointsBounds(points) }
  }
  return { x: element.x + dx, y: element.y + dy }
}

export class SceneStore {
  readonly doc: Y.Doc
  private readonly yElements: Y.Map<Y.Map<unknown>>
  private readonly yOrder: Y.Array<ElementId>
  private readonly yAppState: Y.Map<unknown>

  private snapshot: SceneSnapshot
  private readonly subscribers = new Set<Subscriber>()

  private readonly uiSubscribers = new Set<Subscriber>()
  private readonly selectionSubscribers = new Set<Subscriber>()
  private readonly chromeSubscribers = new Set<Subscriber>()
  private readonly hover = new HoverStore()
  private uiState: UiState = {
    selectedIds: new Set(),
    activeTool: 'select',
    activeShapeType: 'rect',
    activeStickyColor: DEFAULT_STICKY_COLOR,
    clipboardElementCount: 0,
    toolLock: false,
  }

  private readonly localSubscribers = new Set<Subscriber>()
  private localState: LocalAppState

  private readonly arrowsByShape = new Map<ElementId, Set<ElementId>>()
  private readonly arrowBindings = new Map<ElementId, ElementId[]>()
  private readonly routeCache = new RouteCache()
  private selectionStyle: SelectionStyle | null = null
  private clipboard: SceneClipboardPayload | null = null
  private clipboardPasteCount = 0

  private readonly undoManager: Y.UndoManager
  private readonly historySubscribers = new Set<Subscriber>()

  needsRender = true

  constructor(doc: Y.Doc = new Y.Doc()) {
    this.doc = doc
    this.yElements = doc.getMap('elements')
    this.yOrder = doc.getArray('elementOrder')
    this.yAppState = doc.getMap('appState')
    this.localState = readLocalAppState(this.yAppState)

    this.snapshot = this.buildSnapshot()
    this.rebuildBindingIndex()

    this.undoManager = new Y.UndoManager([this.yElements, this.yOrder, this.yAppState], {
      trackedOrigins: new Set([TRANSACTION_ORIGIN]),
      captureTimeout: 500,
    })
    this.undoManager.on('stack-item-added', this.onHistoryChanged)
    this.undoManager.on('stack-item-popped', this.onHistoryChanged)

    this.yElements.observeDeep(this.onElementsChanged)
    this.yOrder.observe(this.onOrderChanged)
    this.yAppState.observe(this.onAppStateChanged)
  }

  getSnapshot(): SceneSnapshot {
    return this.snapshot
  }

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb)
    return () => this.subscribers.delete(cb)
  }

  getUiState(): UiState {
    return this.uiState
  }

  subscribeUi(cb: Subscriber): () => void {
    this.uiSubscribers.add(cb)
    return () => this.uiSubscribers.delete(cb)
  }

  subscribeSelection(cb: Subscriber): () => void {
    this.selectionSubscribers.add(cb)
    return () => this.selectionSubscribers.delete(cb)
  }

  subscribeChrome(cb: Subscriber): () => void {
    this.chromeSubscribers.add(cb)
    return () => this.chromeSubscribers.delete(cb)
  }

  getHoveredId(): ElementId | null {
    return this.hover.get()
  }

  setHoveredId(id: ElementId | null): void {
    this.hover.set(id)
  }

  subscribeHover(cb: Subscriber): () => void {
    return this.hover.subscribe(cb)
  }

  setUiState(patch: Partial<UiState> & { hoveredId?: ElementId | null }): void {
    const { hoveredId, ...uiPatch } = patch
    if (Object.hasOwn(patch, 'hoveredId')) this.setHoveredId(hoveredId ?? null)
    const touchesSelection = Object.hasOwn(uiPatch, 'selectedIds')
    const touchesChrome =
      Object.hasOwn(uiPatch, 'activeTool') ||
      Object.hasOwn(uiPatch, 'activeShapeType') ||
      Object.hasOwn(uiPatch, 'activeStickyColor') ||
      Object.hasOwn(uiPatch, 'clipboardElementCount') ||
      Object.hasOwn(uiPatch, 'toolLock')
    if (!touchesSelection && !touchesChrome) return
    this.uiState = { ...this.uiState, ...uiPatch }
    this.uiSubscribers.forEach((cb) => cb())
    if (touchesSelection) this.selectionSubscribers.forEach((cb) => cb())
    if (touchesChrome) this.chromeSubscribers.forEach((cb) => cb())
  }

  select<T>(selector: (store: SceneStore) => T, options: SelectOptions<T> = {}): StoreSelector<T> {
    const equals = options.equals ?? Object.is
    const channels = options.channels ?? DEFAULT_SELECT_CHANNELS
    let cache: { value: T } | null = null
    const getSnapshot = (): T => {
      const next = selector(this)
      if (cache && equals(cache.value, next)) return cache.value
      cache = { value: next }
      return next
    }
    const subscribe = (cb: Subscriber): (() => void) => {
      const unsubscribers = channels.map((channel) => this.subscribeChannel(channel, cb))
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
    return { subscribe, getSnapshot }
  }

  private subscribeChannel(channel: StoreChannel, cb: Subscriber): () => void {
    switch (channel) {
      case 'doc':
        return this.subscribe(cb)
      case 'selection':
        return this.subscribeSelection(cb)
      case 'chrome':
        return this.subscribeChrome(cb)
      case 'hover':
        return this.subscribeHover(cb)
      case 'local':
        return this.subscribeLocalState(cb)
      case 'history':
        return this.subscribeHistory(cb)
    }
  }

  arrowsForShape(shapeId: ElementId): ReadonlySet<ElementId> {
    return this.arrowsByShape.get(shapeId) ?? new Set()
  }

  transact(fn: (api: TransactionApi) => void): void {
    this.doc.transact(() => {
      fn(this.txnApi)
    }, TRANSACTION_ORIGIN)
  }

  commitCamera(camera: CameraState): void {
    this.setLocalState({ camera })
  }

  setSnapGuidesEnabled(enabled: boolean): void {
    this.setLocalState({ snapGuidesEnabled: enabled })
  }

  getLocalAppState(): LocalAppState {
    return this.localState
  }

  subscribeLocalState(cb: Subscriber): () => void {
    this.localSubscribers.add(cb)
    return () => this.localSubscribers.delete(cb)
  }

  hydrateLocalAppState(patch: Partial<LocalAppState>): void {
    this.setLocalState(patch)
  }

  private setLocalState(patch: Partial<LocalAppState>): void {
    this.localState = { ...this.localState, ...patch }
    this.snapshot = { ...this.snapshot, appState: this.readAppState() }
    this.localSubscribers.forEach((cb) => cb())
    this.invalidate()
  }

  getSlides(): Slide[] {
    return this.snapshot.appState.slides
  }

  addSlide(rect: { x: number; y: number; width: number; height: number }, name?: string): ElementId {
    const slides = this.readSlides()
    const id = createId()
    const slide: Slide = {
      id,
      name: name ?? `Slide ${slides.length + 1}`,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      order: slides.length,
    }
    this.writeSlides([...slides, slide])
    return id
  }

  renameSlide(id: ElementId, name: string): void {
    const slides = this.readSlides()
    if (!slides.some((slide) => slide.id === id)) return
    this.writeSlides(slides.map((slide) => (slide.id === id ? { ...slide, name } : slide)))
  }

  deleteSlide(id: ElementId): void {
    const slides = this.readSlides()
    if (!slides.some((slide) => slide.id === id)) return
    const next = slides
      .filter((slide) => slide.id !== id)
      .map((slide, index) => ({ ...slide, order: index }))
    this.writeSlides(next)
  }

  reorderSlides(orderedIds: ElementId[]): void {
    const slides = this.readSlides()
    const byId = new Map(slides.map((slide) => [slide.id, slide]))
    const next: Slide[] = []
    for (const slideId of orderedIds) {
      const slide = byId.get(slideId)
      if (slide) {
        next.push({ ...slide, order: next.length })
        byId.delete(slideId)
      }
    }
    for (const slide of slides) {
      if (byId.has(slide.id)) {
        next.push({ ...slide, order: next.length })
        byId.delete(slide.id)
      }
    }
    this.writeSlides(next)
  }

  deleteElements(ids: Iterable<ElementId>): void {
    const removal = this.removalIdsFor(ids)
    if (removal.length === 0) return
    this.transact((api) => api.removeElements(removal))
    this.deselect(removal)
  }

  duplicateElements(ids: Iterable<ElementId>): ElementId[] {
    const payload = createSceneClipboard(this.snapshot, ids)
    if (!payload) return []
    const { elements: clones, ids: cloneIds } = cloneSceneClipboard(payload, DUPLICATE_OFFSET_POINT)
    this.stopCapturing()
    this.transact((api) => clones.forEach((clone) => api.addElement(clone)))
    this.stopCapturing()
    this.setUiState({ selectedIds: new Set(cloneIds) })
    return cloneIds
  }

  groupElements(ids: Iterable<ElementId>): ElementId | null {
    const targets = [...ids].filter((id) => this.yElements.has(id))
    if (targets.length < 2) return null
    const groupId = createId()
    this.stopCapturing()
    this.transact((api) => {
      for (const id of targets) api.updateElement(id, { groupId })
    })
    this.stopCapturing()
    return groupId
  }

  ungroupElements(ids: Iterable<ElementId>): void {
    const groupIds = new Set<ElementId>()
    for (const id of ids) {
      const groupId = this.snapshot.elements[id]?.groupId
      if (groupId) groupIds.add(groupId)
    }
    if (groupIds.size === 0) return
    const members = this.snapshot.order.filter((id) => {
      const groupId = this.snapshot.elements[id]?.groupId
      return groupId !== undefined && groupIds.has(groupId)
    })
    if (members.length === 0) return
    this.stopCapturing()
    this.transact((api) => {
      for (const id of members) api.updateElement(id, { groupId: undefined })
    })
    this.stopCapturing()
  }

  lockElements(ids: Iterable<ElementId>): void {
    this.writeLocked([...ids], true)
  }

  unlockAll(): void {
    const locked = this.snapshot.order.filter((id) => this.snapshot.elements[id]?.locked)
    this.writeLocked(locked, false)
  }

  private writeLocked(ids: ElementId[], locked: boolean): void {
    const targets = ids.filter((id) => this.yElements.has(id))
    if (targets.length === 0) return
    this.stopCapturing()
    this.transact((api) => {
      for (const id of targets) api.updateElement(id, { locked })
    })
    this.stopCapturing()
    if (locked) this.deselect(targets)
  }

  bringToFront(ids: Iterable<ElementId>): void {
    this.reorderElements(moveToFront(this.snapshot.order, [...ids]))
  }

  sendToBack(ids: Iterable<ElementId>): void {
    this.reorderElements(moveToBack(this.snapshot.order, [...ids]))
  }

  bringForward(ids: Iterable<ElementId>): void {
    this.reorderElements(moveForward(this.snapshot.order, [...ids]))
  }

  sendBackward(ids: Iterable<ElementId>): void {
    this.reorderElements(moveBackward(this.snapshot.order, [...ids]))
  }

  private reorderElements(order: ElementId[]): void {
    if (sameOrder(order, this.snapshot.order)) return
    this.stopCapturing()
    this.transact((api) => api.reorder(order))
    this.stopCapturing()
  }

  alignElements(ids: Iterable<ElementId>, edge: AlignEdge): void {
    this.applyArrangeDeltas(alignDeltas(this.arrangeTargets(ids), edge))
  }

  distributeElements(ids: Iterable<ElementId>, axis: DistributeAxis): void {
    this.applyArrangeDeltas(distributeDeltas(this.arrangeTargets(ids), axis))
  }

  private arrangeTargets(ids: Iterable<ElementId>): ArrangeTarget[] {
    const targets: ArrangeTarget[] = []
    for (const id of ids) {
      const element = this.snapshot.elements[id]
      if (element) targets.push({ id, bounds: rotatedBounds(element) })
    }
    return targets
  }

  private applyArrangeDeltas(deltas: ArrangeDelta[]): void {
    const moving = deltas.filter((delta) => delta.dx !== 0 || delta.dy !== 0)
    if (moving.length === 0) return
    this.stopCapturing()
    this.transact((api) => {
      for (const { id, dx, dy } of moving) {
        const element = this.snapshot.elements[id]
        if (element) api.updateElement(id, translatedPatch(element, dx, dy))
      }
    })
    this.stopCapturing()
  }

  createClipboard(ids: Iterable<ElementId>): SceneClipboardPayload | null {
    return createSceneClipboard(this.snapshot, ids)
  }

  copyElements(ids: Iterable<ElementId>): SceneClipboardPayload | null {
    const payload = this.createClipboard(ids)
    if (!payload) return null
    this.clipboard = payload
    this.clipboardPasteCount = 0
    this.setUiState({ clipboardElementCount: payload.elements.length })
    return payload
  }

  cutElements(ids: Iterable<ElementId>): SceneClipboardPayload | null {
    const removal = this.removalIdsFor(ids)
    if (removal.length === 0) return null
    const payload = createSceneClipboard(this.snapshot, removal)
    if (!payload) return null
    this.clipboard = payload
    this.clipboardPasteCount = 0
    this.stopCapturing()
    this.transact((api) => api.removeElements(removal))
    this.stopCapturing()
    this.deselect(removal)
    this.setUiState({ clipboardElementCount: payload.elements.length, activeTool: 'select' })
    return payload
  }

  pasteElements(options: PasteElementsOptions = {}): ElementId[] {
    const payload = Object.hasOwn(options, 'payload') ? options.payload : this.clipboard
    if (!payload) return []
    const pasteCount = this.clipboard?.id === payload.id ? this.clipboardPasteCount + 1 : 1
    const offset = options.target
      ? pasteOffsetForTarget(payload, options.target)
      : { x: DUPLICATE_OFFSET * pasteCount, y: DUPLICATE_OFFSET * pasteCount }
    const { elements: clones, ids: cloneIds } = cloneSceneClipboard(payload, offset)
    if (clones.length === 0) return []
    this.stopCapturing()
    this.transact((api) => clones.forEach((clone) => api.addElement(clone)))
    this.stopCapturing()
    this.clipboard = payload
    this.clipboardPasteCount = pasteCount
    this.setUiState({
      selectedIds: new Set(cloneIds),
      activeTool: 'select',
      clipboardElementCount: payload.elements.length,
    })
    return cloneIds
  }

  insertStencil(stencil: Stencil, target: Point | Rect): ElementId[] {
    const offset = pasteOffsetForTarget(stencil.payload, stencilTargetPoint(target))
    const { elements: clones, ids: cloneIds } = cloneSceneClipboard(stencil.payload, offset)
    if (clones.length === 0) return []
    this.stopCapturing()
    this.transact((api) => clones.forEach((clone) => api.addElement(clone)))
    this.stopCapturing()
    this.setUiState({ selectedIds: new Set(cloneIds), activeTool: 'select' })
    return cloneIds
  }

  updateStyle(ids: Iterable<ElementId>, patch: Partial<Style>): void {
    const targets = [...ids].filter((id) => this.yElements.has(id))
    if (targets.length === 0) return
    this.transact((api) => {
      for (const id of targets) {
        const element = this.snapshot.elements[id]
        if (!element) continue
        const style = { ...element.style, ...patch }
        const label =
          patch.textAlign && element.label
            ? { ...element.label, align: patch.textAlign }
            : element.label
        const resize =
          element.type === 'text' && affectsTextSize(patch)
            ? this.resizedTextBox(element, style)
            : null
        api.updateElement(id, {
          style,
          ...(label ? { label } : {}),
          ...(resize ?? {}),
        })
      }
    })
    this.updateLastUsedStyle(patch)
  }

  private resizedTextBox(element: TextElement, style: Style): Pick<Element, 'x' | 'y' | 'width' | 'height'> {
    const size = measureTextBox(element.text, style)
    const cx = element.x + element.width / 2
    const cy = element.y + element.height / 2
    return {
      width: size.width,
      height: size.height,
      x: cx - size.width / 2,
      y: cy - size.height / 2,
    }
  }

  updateArrowheads(ids: Iterable<ElementId>, patch: Partial<Pick<ArrowElement, 'startArrowhead' | 'endArrowhead'>>): void {
    const targets = [...ids].filter((id) => {
      const element = this.snapshot.elements[id]
      return element ? isArrowElement(element) : false
    })
    if (targets.length === 0) return
    this.transact((api) => {
      for (const id of targets) api.updateElement(id, patch)
    })
  }

  getLastUsedStyle(): Style {
    return this.snapshot.appState.lastUsedStyle
  }

  updateLastUsedStyle(patch: Partial<Style>): void {
    this.setLocalState({ lastUsedStyle: { ...this.localState.lastUsedStyle, ...patch } })
  }

  getSelectionStyle(): SelectionStyle {
    const selected = [...this.uiState.selectedIds]
      .map((id) => this.snapshot.elements[id])
      .filter((element): element is Element => Boolean(element))
    const next = deriveSelectionStyle(selected, this.snapshot.appState.lastUsedStyle)
    if (this.selectionStyle && shallowEqualStyle(this.selectionStyle, next)) {
      return this.selectionStyle
    }
    this.selectionStyle = next
    return next
  }

  subscribeStyle(cb: Subscriber): () => void {
    const unsubscribe = this.subscribe(cb)
    const unsubscribeUi = this.subscribeUi(cb)
    return () => {
      unsubscribe()
      unsubscribeUi()
    }
  }

  private deselect(ids: ElementId[]): void {
    const selected = new Set(this.uiState.selectedIds)
    let changed = false
    for (const id of ids) {
      if (selected.delete(id)) changed = true
    }
    if (changed) this.setUiState({ selectedIds: selected })
  }

  private removalIdsFor(ids: Iterable<ElementId>): ElementId[] {
    const direct = [...ids].filter((id) => this.yElements.has(id))
    if (direct.length === 0) return []
    const removal = new Set(direct)
    for (const id of direct) {
      for (const arrowId of this.arrowsForShape(id)) removal.add(arrowId)
    }
    return [...removal]
  }

  stopCapturing(): void {
    this.undoManager.stopCapturing()
  }

  undo(): void {
    this.undoManager.undo()
  }

  redo(): void {
    this.undoManager.redo()
  }

  get canUndo(): boolean {
    return this.undoManager.canUndo()
  }

  get canRedo(): boolean {
    return this.undoManager.canRedo()
  }

  subscribeHistory(cb: Subscriber): () => void {
    this.historySubscribers.add(cb)
    return () => this.historySubscribers.delete(cb)
  }

  destroy(): void {
    this.undoManager.off('stack-item-added', this.onHistoryChanged)
    this.undoManager.off('stack-item-popped', this.onHistoryChanged)
    this.undoManager.destroy()
    this.yElements.unobserveDeep(this.onElementsChanged)
    this.yOrder.unobserve(this.onOrderChanged)
    this.yAppState.unobserve(this.onAppStateChanged)
    this.subscribers.clear()
    this.uiSubscribers.clear()
    this.selectionSubscribers.clear()
    this.chromeSubscribers.clear()
    this.hover.clear()
    this.localSubscribers.clear()
    this.historySubscribers.clear()
  }

  private readonly txnApi: TransactionApi = {
    addElement: (element) => {
      this.yElements.set(element.id, toYElement(element))
      this.yOrder.push([element.id])
    },
    updateElement: (id, patch) => {
      const map = this.yElements.get(id)
      if (!map) return
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'route') continue
        map.set(key, value)
      }
    },
    removeElement: (id) => {
      this.yElements.delete(id)
      const index = this.yOrder.toArray().indexOf(id)
      if (index >= 0) this.yOrder.delete(index, 1)
    },
    removeElements: (ids) => {
      if (ids.length === 0) return
      const remove = new Set(ids)
      for (const id of remove) this.yElements.delete(id)
      const remaining = this.yOrder.toArray().filter((id) => !remove.has(id))
      this.yOrder.delete(0, this.yOrder.length)
      this.yOrder.push(remaining)
    },
    reorder: (order) => {
      this.yOrder.delete(0, this.yOrder.length)
      this.yOrder.push(order)
    },
  }

  private readonly onHistoryChanged = (): void => {
    this.historySubscribers.forEach((cb) => cb())
  }

  private buildSnapshot(): SceneSnapshot {
    const elements: Record<ElementId, Element> = {}
    this.yElements.forEach((map, id) => {
      elements[id] = fromYElement(map)
    })
    return this.routeCache.overlay({
      elements,
      order: this.yOrder.toArray(),
      appState: this.readAppState(),
    })
  }

  private readAppState(): AppState {
    const fallback = defaultAppState()
    const version = this.yAppState.get('schemaVersion')
    return {
      schemaVersion: typeof version === 'number' ? version : fallback.schemaVersion,
      camera: this.localState.camera,
      lastUsedStyle: this.localState.lastUsedStyle,
      snapGuidesEnabled: this.localState.snapGuidesEnabled,
      slides: this.readSlides(),
    }
  }

  private readSlides(): Slide[] {
    return toSlides(this.yAppState.get('slides'))
  }

  private writeSlides(next: Slide[]): void {
    this.doc.transact(() => this.yAppState.set('slides', next), TRANSACTION_ORIGIN)
  }

  private readonly onElementsChanged = (events: Y.YEvent<Y.Map<unknown>>[]): void => {
    const previous = this.snapshot
    const elements = { ...this.snapshot.elements }
    const changedIds = new Set<ElementId>()
    for (const event of events) {
      if (event.target === this.yElements) {
        event.changes.keys.forEach((change, id) => {
          changedIds.add(id)
          if (change.action === 'delete') {
            delete elements[id]
            return
          }
          const map = this.yElements.get(id)
          if (map) elements[id] = fromYElement(map)
        })
        continue
      }
      const map = event.target as Y.Map<unknown>
      const id = map.get('id') as ElementId | undefined
      if (id && this.yElements.has(id)) {
        changedIds.add(id)
        elements[id] = fromYElement(map)
      }
    }
    const next = { ...this.snapshot, elements }
    this.routeCache.invalidateForChanges(previous, next, changedIds)
    this.snapshot = this.routeCache.overlay(next)
    this.updateBindingIndex(changedIds)
    this.invalidate()
  }

  private readonly onOrderChanged = (): void => {
    this.snapshot = { ...this.snapshot, order: this.yOrder.toArray() }
    this.invalidate()
  }

  private readonly onAppStateChanged = (): void => {
    this.snapshot = { ...this.snapshot, appState: this.readAppState() }
    this.invalidate()
  }

  private rebuildBindingIndex(): void {
    this.arrowsByShape.clear()
    this.arrowBindings.clear()
    for (const element of Object.values(this.snapshot.elements)) {
      if (isArrowElement(element)) this.indexArrow(element)
    }
  }

  private updateBindingIndex(changedIds: Set<ElementId>): void {
    for (const id of changedIds) {
      this.unindexArrow(id)
      const element = this.snapshot.elements[id]
      if (element && isArrowElement(element)) this.indexArrow(element)
    }
  }

  private indexArrow(arrow: ArrowElement): void {
    const shapeIds: ElementId[] = []
    for (const binding of [arrow.start, arrow.end]) {
      if (!binding) continue
      shapeIds.push(binding.elementId)
      const set = this.arrowsByShape.get(binding.elementId) ?? new Set()
      set.add(arrow.id)
      this.arrowsByShape.set(binding.elementId, set)
    }
    if (shapeIds.length > 0) this.arrowBindings.set(arrow.id, shapeIds)
  }

  private unindexArrow(arrowId: ElementId): void {
    const shapeIds = this.arrowBindings.get(arrowId)
    if (!shapeIds) return
    for (const shapeId of shapeIds) {
      const set = this.arrowsByShape.get(shapeId)
      if (!set) continue
      set.delete(arrowId)
      if (set.size === 0) this.arrowsByShape.delete(shapeId)
    }
    this.arrowBindings.delete(arrowId)
  }

  private invalidate(): void {
    this.needsRender = true
    this.subscribers.forEach((cb) => cb())
  }
}
