import { arrowRoute } from '../connectors/resolve.js'
import { isArrowElement } from '../model/guards.js'
import type { Element, ElementId, SceneSnapshot } from '../model/types.js'
import { arrowLabelHitRect } from '../text/arrow-label.js'
import {
  candidateSourceFrom,
  localAlignRect,
  rectListProvider,
  type AlignCandidateProvider,
  type AlignCandidateSource,
  type AlignSpace,
} from './align-snap.js'
import { elementBounds } from './hit-test.js'
import { expand, intersects, union, type Rect } from './rect.js'
import { rotatedBounds } from './rotate.js'

export const SPATIAL_CELL_SIZE = 256
export const SPATIAL_MARGIN = 8

const MAX_ITEM_CELLS = 1024

interface GridEntry {
  bounds: Rect
  minCol: number
  minRow: number
  maxCol: number
  maxRow: number
  loose: boolean
}

interface CellSpan {
  minCol: number
  minRow: number
  maxCol: number
  maxRow: number
}

function cellKey(col: number, row: number): string {
  return `${col}:${row}`
}

function finiteRect(rect: Rect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height)
  )
}

function spanCellCount(span: CellSpan): number {
  return (span.maxCol - span.minCol + 1) * (span.maxRow - span.minRow + 1)
}

function sameSpan(a: GridEntry, b: GridEntry): boolean {
  return (
    a.loose === b.loose &&
    a.minCol === b.minCol &&
    a.maxCol === b.maxCol &&
    a.minRow === b.minRow &&
    a.maxRow === b.maxRow
  )
}

export class SpatialIndex {
  private readonly cellSize: number
  private readonly entries = new Map<string, GridEntry>()
  private readonly cells = new Map<string, Set<string>>()
  private readonly columns = new Map<number, Set<string>>()
  private readonly rows = new Map<number, Set<string>>()
  private readonly loose = new Set<string>()

  constructor(cellSize: number = SPATIAL_CELL_SIZE) {
    this.cellSize = cellSize > 0 ? cellSize : SPATIAL_CELL_SIZE
  }

  get size(): number {
    return this.entries.size
  }

  has(id: string): boolean {
    return this.entries.has(id)
  }

  boundsOf(id: string): Rect | null {
    return this.entries.get(id)?.bounds ?? null
  }

  ids(): IterableIterator<string> {
    return this.entries.keys()
  }

  set(id: string, bounds: Rect): void {
    const next = this.entryFor(bounds)
    const current = this.entries.get(id)
    if (current && sameSpan(current, next)) {
      current.bounds = next.bounds
      return
    }
    if (current) this.unlink(id, current)
    this.entries.set(id, next)
    this.link(id, next)
  }

  delete(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    this.unlink(id, entry)
    this.entries.delete(id)
  }

  clear(): void {
    this.entries.clear()
    this.cells.clear()
    this.columns.clear()
    this.rows.clear()
    this.loose.clear()
  }

  query(rect: Rect): string[] {
    if (this.entries.size === 0) return []
    const span = this.spanOf(rect)
    if (!span || spanCellCount(span) > this.entries.size) return this.scan(rect)
    const found = new Set<string>(this.loose)
    for (let row = span.minRow; row <= span.maxRow; row += 1) {
      for (let col = span.minCol; col <= span.maxCol; col += 1) {
        const cell = this.cells.get(cellKey(col, row))
        if (!cell) continue
        for (const id of cell) found.add(id)
      }
    }
    return [...found]
  }

  columnCandidates(min: number, max: number): string[] {
    return this.axisCandidates(this.columns, this.cellOf(min), this.cellOf(max), (entry) =>
      entry.bounds.x + entry.bounds.width >= min && entry.bounds.x <= max,
    )
  }

  rowCandidates(min: number, max: number): string[] {
    return this.axisCandidates(this.rows, this.cellOf(min), this.cellOf(max), (entry) =>
      entry.bounds.y + entry.bounds.height >= min && entry.bounds.y <= max,
    )
  }

  private axisCandidates(
    buckets: Map<number, Set<string>>,
    min: number,
    max: number,
    overlaps: (entry: GridEntry) => boolean,
  ): string[] {
    if (this.entries.size === 0) return []
    if (!Number.isFinite(min) || !Number.isFinite(max) || max - min + 1 > this.entries.size) {
      return this.filterEntries(overlaps)
    }
    const found = new Set<string>(this.loose)
    for (let bucket = min; bucket <= max; bucket += 1) {
      const ids = buckets.get(bucket)
      if (!ids) continue
      for (const id of ids) found.add(id)
    }
    return [...found]
  }

  private scan(rect: Rect): string[] {
    return this.filterEntries((entry) => intersects(entry.bounds, rect))
  }

  private filterEntries(keep: (entry: GridEntry) => boolean): string[] {
    const found: string[] = []
    for (const [id, entry] of this.entries) {
      if (entry.loose || keep(entry)) found.push(id)
    }
    return found
  }

  private cellOf(value: number): number {
    return Math.floor(value / this.cellSize)
  }

  private spanOf(rect: Rect): CellSpan | null {
    if (!finiteRect(rect)) return null
    return {
      minCol: this.cellOf(rect.x),
      maxCol: this.cellOf(rect.x + rect.width),
      minRow: this.cellOf(rect.y),
      maxRow: this.cellOf(rect.y + rect.height),
    }
  }

  private entryFor(bounds: Rect): GridEntry {
    const box = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    const span = this.spanOf(box)
    if (!span || spanCellCount(span) > MAX_ITEM_CELLS) {
      return { bounds: box, minCol: 0, minRow: 0, maxCol: 0, maxRow: 0, loose: true }
    }
    return { bounds: box, ...span, loose: false }
  }

  private link(id: string, entry: GridEntry): void {
    if (entry.loose) {
      this.loose.add(id)
      return
    }
    for (let row = entry.minRow; row <= entry.maxRow; row += 1) {
      for (let col = entry.minCol; col <= entry.maxCol; col += 1) {
        addTo(this.cells, cellKey(col, row), id)
      }
      addTo(this.rows, row, id)
    }
    for (let col = entry.minCol; col <= entry.maxCol; col += 1) {
      addTo(this.columns, col, id)
    }
  }

  private unlink(id: string, entry: GridEntry): void {
    if (entry.loose) {
      this.loose.delete(id)
      return
    }
    for (let row = entry.minRow; row <= entry.maxRow; row += 1) {
      for (let col = entry.minCol; col <= entry.maxCol; col += 1) {
        removeFrom(this.cells, cellKey(col, row), id)
      }
      removeFrom(this.rows, row, id)
    }
    for (let col = entry.minCol; col <= entry.maxCol; col += 1) {
      removeFrom(this.columns, col, id)
    }
  }
}

function addTo<K>(buckets: Map<K, Set<string>>, key: K, id: string): void {
  const bucket = buckets.get(key)
  if (bucket) {
    bucket.add(id)
    return
  }
  buckets.set(key, new Set([id]))
}

function removeFrom<K>(buckets: Map<K, Set<string>>, key: K, id: string): void {
  const bucket = buckets.get(key)
  if (!bucket) return
  bucket.delete(id)
  if (bucket.size === 0) buckets.delete(key)
}

export type SceneScope = (rect: Rect) => SceneSnapshot

export function elementIndexBounds(element: Element): Rect {
  const box = union(elementBounds(element), rotatedBounds(element))
  const withLabel =
    isArrowElement(element) && element.label?.text
      ? union(box, arrowLabelHitRect(arrowRoute(element), element.label.text, element.style))
      : box
  return expand(withLabel, element.style.strokeWidth + SPATIAL_MARGIN)
}

export class SceneIndex {
  private readonly grid: SpatialIndex
  private readonly ranks = new Map<ElementId, number>()
  private stamp = 0

  constructor(cellSize: number = SPATIAL_CELL_SIZE) {
    this.grid = new SpatialIndex(cellSize)
  }

  get revision(): number {
    return this.stamp
  }

  get size(): number {
    return this.grid.size
  }

  boundsOf(id: ElementId): Rect | null {
    return this.grid.boundsOf(id)
  }

  rebuild(snapshot: SceneSnapshot): void {
    this.grid.clear()
    for (const id of snapshot.order) {
      const element = snapshot.elements[id]
      if (element) this.grid.set(id, elementIndexBounds(element))
    }
    this.setOrder(snapshot.order)
  }

  setOrder(order: readonly ElementId[]): void {
    this.ranks.clear()
    order.forEach((id, rank) => this.ranks.set(id, rank))
    this.stamp += 1
  }

  upsert(element: Element): void {
    this.grid.set(element.id, elementIndexBounds(element))
    this.stamp += 1
  }

  remove(id: ElementId): void {
    if (!this.grid.has(id)) return
    this.grid.delete(id)
    this.stamp += 1
  }

  candidates(rect: Rect): ElementId[] {
    return this.ordered(this.grid.query(rect))
  }

  columnCandidates(min: number, max: number): ElementId[] {
    return this.ordered(this.grid.columnCandidates(min, max))
  }

  rowCandidates(min: number, max: number): ElementId[] {
    return this.ordered(this.grid.rowCandidates(min, max))
  }

  scope(snapshot: SceneSnapshot, rect: Rect): SceneSnapshot {
    return { ...snapshot, order: this.candidates(rect) }
  }

  private ordered(ids: string[]): ElementId[] {
    const ranked = ids.filter((id) => this.ranks.has(id))
    ranked.sort((a, b) => (this.ranks.get(a) ?? 0) - (this.ranks.get(b) ?? 0))
    return ranked
  }
}

export interface SceneAlignSourceInput {
  index: SceneIndex
  snapshot: SceneSnapshot
  exclude: ReadonlySet<ElementId>
  space: AlignSpace
}

export function sceneAlignSource(input: SceneAlignSourceInput): AlignCandidateSource {
  const { index, snapshot, exclude, space } = input
  const localRects = new Map<ElementId, Rect | null>()
  let revision = -1
  let everything: Rect[] | null = null

  const sync = (): void => {
    if (revision === index.revision) return
    revision = index.revision
    localRects.clear()
    everything = null
  }

  const rectFor = (id: ElementId): Rect | null => {
    const cached = localRects.get(id)
    if (cached !== undefined) return cached
    const element = snapshot.elements[id]
    const rect =
      !element || isArrowElement(element) || exclude.has(id)
        ? null
        : localAlignRect({ ...elementBounds(element), rotation: element.rotation }, space)
    localRects.set(id, rect)
    return rect
  }

  const collect = (ids: Iterable<ElementId>): Rect[] => {
    const rects: Rect[] = []
    for (const id of ids) {
      const rect = rectFor(id)
      if (rect) rects.push(rect)
    }
    return rects
  }

  const all = (): Rect[] => {
    sync()
    everything ??= collect(snapshot.order)
    return everything
  }

  if (space.rotation) return candidateSourceFrom(rectListProvider(all))

  const provider: AlignCandidateProvider = {
    all,
    nearColumns: (min, max) => {
      sync()
      return collect(index.columnCandidates(min, max))
    },
    nearRows: (min, max) => {
      sync()
      return collect(index.rowCandidates(min, max))
    },
  }
  return candidateSourceFrom(provider)
}
