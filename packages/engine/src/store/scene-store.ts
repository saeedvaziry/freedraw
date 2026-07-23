import * as Y from 'yjs'
import { DEFAULT_STICKY_COLOR, type StickyColor } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import { defaultAppState } from '../model/schema.js'
import type {
  AppState,
  ArrowElement,
  CameraState,
  Element,
  ElementId,
  Point,
  SceneSnapshot,
  ShapeType,
  Style,
  TextElement,
} from '../model/types.js'
import {
  clipboardCenter,
  cloneSceneClipboard,
  createSceneClipboard,
  type SceneClipboardPayload,
} from './clipboard.js'
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
  hoveredId: ElementId | null
  activeTool: ToolId
  activeShapeType: ShapeType
  activeStickyColor: StickyColor
  clipboardElementCount: number
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

export class SceneStore {
  readonly doc: Y.Doc
  private readonly yElements: Y.Map<Y.Map<unknown>>
  private readonly yOrder: Y.Array<ElementId>
  private readonly yAppState: Y.Map<unknown>

  private snapshot: SceneSnapshot
  private readonly subscribers = new Set<Subscriber>()

  private readonly uiSubscribers = new Set<Subscriber>()
  private uiState: UiState = {
    selectedIds: new Set(),
    hoveredId: null,
    activeTool: 'select',
    activeShapeType: 'rect',
    activeStickyColor: DEFAULT_STICKY_COLOR,
    clipboardElementCount: 0,
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

  setUiState(patch: Partial<UiState>): void {
    this.uiState = { ...this.uiState, ...patch }
    this.uiSubscribers.forEach((cb) => cb())
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
    }
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
