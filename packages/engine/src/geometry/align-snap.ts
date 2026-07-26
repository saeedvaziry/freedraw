import type { Point } from '../model/types.js'
import type { Rect } from './rect.js'
import { rotatePoint } from './rotate.js'
import type { SnapGuide } from './snap.js'

export const ALIGN_SNAP_DISTANCE = 4

const ORIENTATION_EPSILON = 1e-9
const FULL_TURN = Math.PI * 2

export interface AlignSpace {
  center: Point
  rotation: number
}

export interface AlignCandidate extends Rect {
  rotation: number
}

const WORLD_SPACE: AlignSpace = { center: { x: 0, y: 0 }, rotation: 0 }

interface Edges {
  left: number
  centerX: number
  right: number
  top: number
  centerY: number
  bottom: number
}

export interface AlignLine {
  axis: 'x' | 'y'
  position: number
  start: number
  end: number
}

export interface DistanceIndicator {
  axis: 'x' | 'y'
  from: number
  to: number
  position: number
}

export interface MoveSnapResult {
  dx: number
  dy: number
  lines: AlignLine[]
  distances: DistanceIndicator[]
}

export interface ResizeEdges {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

export interface ResizeSnapResult {
  bounds: Rect
  lines: AlignLine[]
}

interface EqualSpacingSnap {
  delta: number
  indicator: DistanceIndicator
}

function edgesOf(rect: Rect): Edges {
  return {
    left: rect.x,
    centerX: rect.x + rect.width / 2,
    right: rect.x + rect.width,
    top: rect.y,
    centerY: rect.y + rect.height / 2,
    bottom: rect.y + rect.height,
  }
}

function lineExtent(axis: 'x' | 'y', moving: Edges, other: Edges): { start: number; end: number } {
  if (axis === 'x') {
    const values = [moving.top, moving.bottom, other.top, other.bottom]
    return { start: Math.min(...values), end: Math.max(...values) }
  }
  const values = [moving.left, moving.right, other.left, other.right]
  return { start: Math.min(...values), end: Math.max(...values) }
}

function overlapsOnY(a: Rect, b: Rect): boolean {
  return a.y + a.height > b.y && a.y < b.y + b.height
}

function overlapsOnX(a: Rect, b: Rect): boolean {
  return a.x + a.width > b.x && a.x < b.x + b.width
}

export interface AlignCandidateSource {
  all(): Rect[]
  rowBand(rect: Rect): Rect[]
  columnBand(rect: Rect): Rect[]
  xRange(min: number, max: number): Rect[]
  yRange(min: number, max: number): Rect[]
}

export interface AlignCandidateProvider {
  all(): Rect[]
  nearColumns(min: number, max: number): Rect[]
  nearRows(min: number, max: number): Rect[]
}

function spansX(rect: Rect, min: number, max: number): boolean {
  return rect.x + rect.width >= min && rect.x <= max
}

function spansY(rect: Rect, min: number, max: number): boolean {
  return rect.y + rect.height >= min && rect.y <= max
}

export function candidateSourceFrom(provider: AlignCandidateProvider): AlignCandidateSource {
  return {
    all: () => provider.all(),
    rowBand: (rect) =>
      provider.nearRows(rect.y, rect.y + rect.height).filter((o) => overlapsOnY(o, rect)),
    columnBand: (rect) =>
      provider.nearColumns(rect.x, rect.x + rect.width).filter((o) => overlapsOnX(o, rect)),
    xRange: (min, max) => provider.nearColumns(min, max),
    yRange: (min, max) => provider.nearRows(min, max),
  }
}

export function rectListProvider(rects: () => Rect[]): AlignCandidateProvider {
  return {
    all: rects,
    nearColumns: (min, max) => rects().filter((o) => spansX(o, min, max)),
    nearRows: (min, max) => rects().filter((o) => spansY(o, min, max)),
  }
}

export function arrayCandidateSource(others: Rect[]): AlignCandidateSource {
  return candidateSourceFrom(rectListProvider(() => others))
}

export function localAlignRects(candidates: AlignCandidate[], space: AlignSpace): Rect[] {
  return candidates.map((candidate) => localAlignRect(candidate, space))
}

function plainRect(rect: Rect): Rect {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
}

export function localAlignRect(candidate: AlignCandidate, space: AlignSpace): Rect {
  if (!sameOrientation(candidate.rotation, space.rotation)) return localCornerBounds(candidate, space)
  if (!space.rotation) return plainRect(candidate)
  const center = toLocal({ x: candidate.x + candidate.width / 2, y: candidate.y + candidate.height / 2 }, space)
  return {
    x: center.x - candidate.width / 2,
    y: center.y - candidate.height / 2,
    width: candidate.width,
    height: candidate.height,
  }
}

function localCornerBounds(candidate: AlignCandidate, space: AlignSpace): Rect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const corner of candidateCorners(candidate)) {
    const local = toLocal(corner, space)
    minX = Math.min(minX, local.x)
    minY = Math.min(minY, local.y)
    maxX = Math.max(maxX, local.x)
    maxY = Math.max(maxY, local.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function candidateCorners(candidate: AlignCandidate): Point[] {
  const corners = rectCorners(candidate)
  if (!candidate.rotation) return corners
  const center = { x: candidate.x + candidate.width / 2, y: candidate.y + candidate.height / 2 }
  return corners.map((corner) => rotatePoint(corner, center, candidate.rotation))
}

function rectCorners(rect: Rect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
}

function sameOrientation(a: number, b: number): boolean {
  const diff = Math.abs(a - b) % FULL_TURN
  return Math.min(diff, FULL_TURN - diff) < ORIENTATION_EPSILON
}

function toLocal(point: Point, space: AlignSpace): Point {
  return rotatePoint(point, space.center, -space.rotation)
}

function toWorld(point: Point, space: AlignSpace): Point {
  return rotatePoint(point, space.center, space.rotation)
}

function findEqualSpacingSnapX(moving: Rect, source: AlignCandidateSource, threshold: number): EqualSpacingSnap | null {
  let best: EqualSpacingSnap | null = null
  const movingCenterY = moving.y + moving.height / 2
  const anchors = source.rowBand(moving)
  if (anchors.length === 0) return null
  const others = source.all()
  for (let i = 0; i < others.length; i += 1) {
    const leftRef = others[i]!
    for (let j = 0; j < others.length; j += 1) {
      if (i === j) continue
      const rightRef = others[j]!
      if (!overlapsOnY(leftRef, rightRef)) continue
      const referenceGap = rightRef.x - (leftRef.x + leftRef.width)
      if (referenceGap <= 0) continue
      for (const anchor of anchors) {
        const candidateRight = anchor.x + anchor.width + referenceGap
        const deltaRight = candidateRight - moving.x
        if (Math.abs(deltaRight) < threshold && (!best || Math.abs(deltaRight) < Math.abs(best.delta))) {
          best = {
            delta: deltaRight,
            indicator: { axis: 'x', from: anchor.x + anchor.width, to: candidateRight, position: movingCenterY },
          }
        }
        const candidateLeft = anchor.x - referenceGap - moving.width
        const deltaLeft = candidateLeft - moving.x
        if (Math.abs(deltaLeft) < threshold && (!best || Math.abs(deltaLeft) < Math.abs(best.delta))) {
          best = {
            delta: deltaLeft,
            indicator: { axis: 'x', from: candidateLeft + moving.width, to: anchor.x, position: movingCenterY },
          }
        }
      }
    }
  }
  return best
}

function findEqualSpacingSnapY(moving: Rect, source: AlignCandidateSource, threshold: number): EqualSpacingSnap | null {
  let best: EqualSpacingSnap | null = null
  const movingCenterX = moving.x + moving.width / 2
  const anchors = source.columnBand(moving)
  if (anchors.length === 0) return null
  const others = source.all()
  for (let i = 0; i < others.length; i += 1) {
    const topRef = others[i]!
    for (let j = 0; j < others.length; j += 1) {
      if (i === j) continue
      const bottomRef = others[j]!
      if (!overlapsOnX(topRef, bottomRef)) continue
      const referenceGap = bottomRef.y - (topRef.y + topRef.height)
      if (referenceGap <= 0) continue
      for (const anchor of anchors) {
        const candidateBelow = anchor.y + anchor.height + referenceGap
        const deltaBelow = candidateBelow - moving.y
        if (Math.abs(deltaBelow) < threshold && (!best || Math.abs(deltaBelow) < Math.abs(best.delta))) {
          best = {
            delta: deltaBelow,
            indicator: { axis: 'y', from: anchor.y + anchor.height, to: candidateBelow, position: movingCenterX },
          }
        }
        const candidateAbove = anchor.y - referenceGap - moving.height
        const deltaAbove = candidateAbove - moving.y
        if (Math.abs(deltaAbove) < threshold && (!best || Math.abs(deltaAbove) < Math.abs(best.delta))) {
          best = {
            delta: deltaAbove,
            indicator: { axis: 'y', from: candidateAbove + moving.height, to: anchor.y, position: movingCenterX },
          }
        }
      }
    }
  }
  return best
}

function nearestGapIndicators(
  moving: Rect,
  source: AlignCandidateSource,
  snappedOnX: boolean,
  snappedOnY: boolean,
): DistanceIndicator[] {
  const indicators: DistanceIndicator[] = []
  const movingLeft = moving.x
  const movingRight = moving.x + moving.width
  const movingTop = moving.y
  const movingBottom = moving.y + moving.height
  const movingCenterX = moving.x + moving.width / 2
  const movingCenterY = moving.y + moving.height / 2

  if (snappedOnY) {
    const row = source.rowBand(moving)
    const left = row.filter((s) => s.x + s.width <= movingLeft && s.y + s.height > movingTop && s.y < movingBottom)
    const right = row.filter((s) => s.x >= movingRight && s.y + s.height > movingTop && s.y < movingBottom)
    if (left.length > 0) {
      const nearest = left.reduce((best, s) => (s.x + s.width > best.x + best.width ? s : best))
      if (movingLeft - (nearest.x + nearest.width) > 0) {
        indicators.push({ axis: 'x', from: nearest.x + nearest.width, to: movingLeft, position: movingCenterY })
      }
    }
    if (right.length > 0) {
      const nearest = right.reduce((best, s) => (s.x < best.x ? s : best))
      if (nearest.x - movingRight > 0) {
        indicators.push({ axis: 'x', from: movingRight, to: nearest.x, position: movingCenterY })
      }
    }
  }

  if (snappedOnX) {
    const column = source.columnBand(moving)
    const above = column.filter((s) => s.y + s.height <= movingTop && s.x + s.width > movingLeft && s.x < movingRight)
    const below = column.filter((s) => s.y >= movingBottom && s.x + s.width > movingLeft && s.x < movingRight)
    if (above.length > 0) {
      const nearest = above.reduce((best, s) => (s.y + s.height > best.y + best.height ? s : best))
      if (movingTop - (nearest.y + nearest.height) > 0) {
        indicators.push({ axis: 'y', from: nearest.y + nearest.height, to: movingTop, position: movingCenterX })
      }
    }
    if (below.length > 0) {
      const nearest = below.reduce((best, s) => (s.y < best.y ? s : best))
      if (nearest.y - movingBottom > 0) {
        indicators.push({ axis: 'y', from: movingBottom, to: nearest.y, position: movingCenterX })
      }
    }
  }

  return indicators
}

interface AxisAccumulator {
  best: number
  position: number | null
  snappedValue: number
  candidates: Edges[]
}

function newAxis(threshold: number): AxisAccumulator {
  return { best: threshold, position: null, snappedValue: 0, candidates: [] }
}

function matchEdge(axis: AxisAccumulator, myEdge: number, otherEdge: number, base: number, threshold: number, other: Edges): void {
  const d = Math.abs(myEdge - otherEdge)
  if (d < axis.best) {
    axis.best = d
    axis.position = otherEdge
    axis.snappedValue = base + (otherEdge - myEdge)
    axis.candidates = [other]
    return
  }
  if (d === axis.best && axis.best < threshold) axis.candidates.push(other)
}

function mergeLines(axis: 'x' | 'y', position: number, moving: Edges, candidates: Edges[]): AlignLine | null {
  if (candidates.length === 0) return null
  let start = Infinity
  let end = -Infinity
  for (const other of candidates) {
    const extent = lineExtent(axis, moving, other)
    start = Math.min(start, extent.start)
    end = Math.max(end, extent.end)
  }
  return { axis, position, start, end }
}

export function snapMove(
  moving: Rect,
  others: Rect[],
  threshold: number,
  source: AlignCandidateSource = arrayCandidateSource(others),
): MoveSnapResult {
  return snapMoveFrom(moving, source, threshold)
}

export function snapMoveFrom(moving: Rect, source: AlignCandidateSource, threshold: number): MoveSnapResult {
  const movingEdges = edgesOf(moving)
  const axisX = newAxis(threshold)
  const axisY = newAxis(threshold)

  for (const other of source.xRange(moving.x - threshold, moving.x + moving.width + threshold)) {
    const otherEdges = edgesOf(other)
    for (const myEdge of [movingEdges.left, movingEdges.centerX, movingEdges.right]) {
      for (const otherEdge of [otherEdges.left, otherEdges.centerX, otherEdges.right]) {
        matchEdge(axisX, myEdge, otherEdge, moving.x, threshold, otherEdges)
      }
    }
  }
  for (const other of source.yRange(moving.y - threshold, moving.y + moving.height + threshold)) {
    const otherEdges = edgesOf(other)
    for (const myEdge of [movingEdges.top, movingEdges.centerY, movingEdges.bottom]) {
      for (const otherEdge of [otherEdges.top, otherEdges.centerY, otherEdges.bottom]) {
        matchEdge(axisY, myEdge, otherEdge, moving.y, threshold, otherEdges)
      }
    }
  }

  let snappedX = axisX.position === null ? moving.x : axisX.snappedValue
  let snappedY = axisY.position === null ? moving.y : axisY.snappedValue
  let equalSpacingX: EqualSpacingSnap | null = null
  let equalSpacingY: EqualSpacingSnap | null = null

  const equalX = findEqualSpacingSnapX(moving, source, threshold)
  if (equalX && Math.abs(equalX.delta) < axisX.best) {
    axisX.best = Math.abs(equalX.delta)
    snappedX = moving.x + equalX.delta
    axisX.candidates = []
    axisX.position = null
    equalSpacingX = equalX
  }

  const equalY = findEqualSpacingSnapY(moving, source, threshold)
  if (equalY && Math.abs(equalY.delta) < axisY.best) {
    axisY.best = Math.abs(equalY.delta)
    snappedY = moving.y + equalY.delta
    axisY.candidates = []
    axisY.position = null
    equalSpacingY = equalY
  }

  const snappedEdges = edgesOf({ ...moving, x: snappedX, y: snappedY })
  const lines: AlignLine[] = []
  if (axisX.position !== null) {
    const line = mergeLines('x', axisX.position, snappedEdges, axisX.candidates)
    if (line) lines.push(line)
  }
  if (axisY.position !== null) {
    const line = mergeLines('y', axisY.position, snappedEdges, axisY.candidates)
    if (line) lines.push(line)
  }

  const snappedRect: Rect = { ...moving, x: snappedX, y: snappedY }
  const distances = nearestGapIndicators(snappedRect, source, axisX.best < threshold, axisY.best < threshold)
  if (equalSpacingX) distances.push(equalSpacingX.indicator)
  if (equalSpacingY) distances.push(equalSpacingY.indicator)

  return { dx: snappedX - moving.x, dy: snappedY - moving.y, lines, distances }
}

export function snapResizeBounds(
  bounds: Rect,
  edges: ResizeEdges,
  others: Rect[],
  threshold: number,
  source: AlignCandidateSource = arrayCandidateSource(others),
): ResizeSnapResult {
  return snapResizeBoundsFrom(bounds, edges, source, threshold)
}

function edgeWindow(values: number[], threshold: number): { min: number; max: number } | null {
  if (values.length === 0) return null
  return { min: Math.min(...values) - threshold, max: Math.max(...values) + threshold }
}

export function snapResizeBoundsFrom(
  bounds: Rect,
  edges: ResizeEdges,
  source: AlignCandidateSource,
  threshold: number,
): ResizeSnapResult {
  let { x, y, width, height } = bounds
  const left = x
  const right = x + width
  const top = y
  const bottom = y + height

  const leftAxis = newAxis(threshold)
  const rightAxis = newAxis(threshold)
  const topAxis = newAxis(threshold)
  const bottomAxis = newAxis(threshold)

  const xWindow = edgeWindow([...(edges.left ? [left] : []), ...(edges.right ? [right] : [])], threshold)
  const yWindow = edgeWindow([...(edges.top ? [top] : []), ...(edges.bottom ? [bottom] : [])], threshold)

  if (xWindow) {
    for (const other of source.xRange(xWindow.min, xWindow.max)) {
      const otherEdges = edgesOf(other)
      for (const otherEdge of [otherEdges.left, otherEdges.centerX, otherEdges.right]) {
        if (edges.left) matchEdge(leftAxis, left, otherEdge, left, threshold, otherEdges)
        if (edges.right) matchEdge(rightAxis, right, otherEdge, right, threshold, otherEdges)
      }
    }
  }
  if (yWindow) {
    for (const other of source.yRange(yWindow.min, yWindow.max)) {
      const otherEdges = edgesOf(other)
      for (const otherEdge of [otherEdges.top, otherEdges.centerY, otherEdges.bottom]) {
        if (edges.top) matchEdge(topAxis, top, otherEdge, top, threshold, otherEdges)
        if (edges.bottom) matchEdge(bottomAxis, bottom, otherEdge, bottom, threshold, otherEdges)
      }
    }
  }

  if (edges.left && !edges.right && leftAxis.position !== null) {
    width -= leftAxis.position - left
    x = leftAxis.position
  }
  if (edges.right && !edges.left && rightAxis.position !== null) width = rightAxis.position - x
  if (edges.top && !edges.bottom && topAxis.position !== null) {
    height -= topAxis.position - top
    y = topAxis.position
  }
  if (edges.bottom && !edges.top && bottomAxis.position !== null) height = bottomAxis.position - y

  const snappedEdges = edgesOf({ x, y, width, height })
  const lines: AlignLine[] = []
  const pushLine = (axis: AxisAccumulator, orientation: 'x' | 'y') => {
    if (axis.position === null) return
    const line = mergeLines(orientation, axis.position, snappedEdges, axis.candidates)
    if (line) lines.push(line)
  }
  pushLine(leftAxis, 'x')
  pushLine(rightAxis, 'x')
  pushLine(topAxis, 'y')
  pushLine(bottomAxis, 'y')

  return { bounds: { x, y, width, height }, lines }
}

function lineGuide(line: AlignLine, space: AlignSpace): SnapGuide {
  const from: Point = line.axis === 'x' ? { x: line.position, y: line.start } : { x: line.start, y: line.position }
  const to: Point = line.axis === 'x' ? { x: line.position, y: line.end } : { x: line.end, y: line.position }
  return { kind: 'align', from: toWorld(from, space), to: toWorld(to, space) }
}

function distanceGuide(indicator: DistanceIndicator, space: AlignSpace): SnapGuide {
  const from: Point =
    indicator.axis === 'x' ? { x: indicator.from, y: indicator.position } : { x: indicator.position, y: indicator.from }
  const to: Point =
    indicator.axis === 'x' ? { x: indicator.to, y: indicator.position } : { x: indicator.position, y: indicator.to }
  return {
    kind: 'distance',
    from: toWorld(from, space),
    to: toWorld(to, space),
    label: Math.abs(indicator.to - indicator.from),
  }
}

export function alignGuides(
  lines: AlignLine[],
  distances: DistanceIndicator[] = [],
  space: AlignSpace = WORLD_SPACE,
): SnapGuide[] {
  return [
    ...lines.map((line) => lineGuide(line, space)),
    ...distances.map((indicator) => distanceGuide(indicator, space)),
  ]
}
