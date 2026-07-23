import type { ElementId } from '../model/types.js'
import type { Rect } from './rect.js'

export type AlignEdge = 'left' | 'centerX' | 'right' | 'top' | 'middleY' | 'bottom'

export type DistributeAxis = 'horizontal' | 'vertical'

export interface ArrangeTarget {
  id: ElementId
  bounds: Rect
}

export interface ArrangeDelta {
  id: ElementId
  dx: number
  dy: number
}

export function alignDeltas(targets: ArrangeTarget[], edge: AlignEdge): ArrangeDelta[] {
  if (targets.length < 2) return []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const { bounds } of targets) {
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  }
  const centerX = (minX + maxX) / 2
  const middleY = (minY + maxY) / 2
  return targets.map(({ id, bounds }) => {
    let dx = 0
    let dy = 0
    switch (edge) {
      case 'left':
        dx = minX - bounds.x
        break
      case 'centerX':
        dx = centerX - (bounds.x + bounds.width / 2)
        break
      case 'right':
        dx = maxX - (bounds.x + bounds.width)
        break
      case 'top':
        dy = minY - bounds.y
        break
      case 'middleY':
        dy = middleY - (bounds.y + bounds.height / 2)
        break
      case 'bottom':
        dy = maxY - (bounds.y + bounds.height)
        break
    }
    return { id, dx, dy }
  })
}

export function distributeDeltas(targets: ArrangeTarget[], axis: DistributeAxis): ArrangeDelta[] {
  if (targets.length < 3) return []
  const horizontal = axis === 'horizontal'
  const start = (bounds: Rect): number => (horizontal ? bounds.x : bounds.y)
  const size = (bounds: Rect): number => (horizontal ? bounds.width : bounds.height)
  const sorted = [...targets].sort((a, b) => start(a.bounds) - start(b.bounds))
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const spanStart = start(first.bounds)
  const spanEnd = start(last.bounds) + size(last.bounds)
  const totalSize = sorted.reduce((sum, target) => sum + size(target.bounds), 0)
  const gap = (spanEnd - spanStart - totalSize) / (sorted.length - 1)
  const offsets = new Map<ElementId, number>()
  let cursor = spanStart
  for (const target of sorted) {
    offsets.set(target.id, cursor - start(target.bounds))
    cursor += size(target.bounds) + gap
  }
  return targets.map(({ id }) => {
    const offset = offsets.get(id) ?? 0
    return { id, dx: horizontal ? offset : 0, dy: horizontal ? 0 : offset }
  })
}
