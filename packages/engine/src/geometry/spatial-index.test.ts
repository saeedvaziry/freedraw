import { describe, expect, it } from 'vitest'
import { createBinding } from '../connectors/binding.js'
import { obstacleBounds, planConnectedShape, spawnSearchRegion } from '../connectors/spawn.js'
import {
  createArrow,
  createFreedraw,
  createShape,
  createSticky,
  createText,
} from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import type { Element, ElementId, Point, SceneSnapshot } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import {
  localAlignRects,
  snapMove,
  snapMoveFrom,
  snapResizeBounds,
  snapResizeBoundsFrom,
  type AlignCandidate,
  type AlignSpace,
} from './align-snap.js'
import { elementBounds, hitTest, marqueeHits } from './hit-test.js'
import { expand, intersects, pointRect, type Rect } from './rect.js'
import { snapEndpoint } from './snap.js'
import { SceneIndex, SpatialIndex, elementIndexBounds, sceneAlignSource } from './spatial-index.js'

const rect = (x: number, y: number, width = 20, height = 20): Rect => ({ x, y, width, height })

function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('SpatialIndex', () => {
  it('answers queries on an empty index', () => {
    const index = new SpatialIndex()

    expect(index.size).toBe(0)
    expect(index.query(rect(0, 0, 1000, 1000))).toEqual([])
    expect(index.columnCandidates(0, 100)).toEqual([])
    expect(index.rowCandidates(0, 100)).toEqual([])
    expect(index.boundsOf('missing')).toBeNull()
  })

  it('returns items whose cells overlap the query and skips the rest', () => {
    const index = new SpatialIndex(100)
    index.set('a', rect(0, 0, 50, 50))
    index.set('b', rect(4000, 4000, 50, 50))

    expect(index.query(rect(10, 10, 5, 5))).toEqual(['a'])
    expect(index.query(rect(4010, 4010, 5, 5))).toEqual(['b'])
    expect(index.query(rect(3990, 3990, 20, 20))).toEqual(['b'])
    expect(index.query(rect(1000, 1000, 10, 10))).toEqual([])
    expect(index.size).toBe(2)
    expect(index.has('a')).toBe(true)
  })

  it('drops an item from its old cells when it moves', () => {
    const index = new SpatialIndex(100)
    index.set('a', rect(0, 0, 10, 10))
    index.set('a', rect(5000, 5000, 10, 10))

    expect(index.query(rect(0, 0, 10, 10))).toEqual([])
    expect(index.query(rect(5000, 5000, 10, 10))).toEqual(['a'])
    expect(index.size).toBe(1)
    expect(index.boundsOf('a')).toEqual(rect(5000, 5000, 10, 10))
  })

  it('keeps a small move inside the same cell queryable', () => {
    const index = new SpatialIndex(100)
    index.set('a', rect(10, 10, 10, 10))
    index.set('a', rect(12, 14, 10, 10))

    expect(index.query(rect(12, 14, 1, 1))).toEqual(['a'])
    expect(index.boundsOf('a')).toEqual(rect(12, 14, 10, 10))
  })

  it('removes and clears items', () => {
    const index = new SpatialIndex(100)
    index.set('a', rect(0, 0))
    index.set('b', rect(500, 500))
    index.delete('a')

    expect(index.query(rect(-10, -10, 40, 40))).toEqual([])
    expect(index.size).toBe(1)

    index.delete('missing')
    index.clear()
    expect(index.size).toBe(0)
    expect(index.query(rect(500, 500, 10, 10))).toEqual([])
  })

  it('indexes items at huge coordinates without scanning every cell', () => {
    const index = new SpatialIndex(100)
    index.set('far', rect(1e15, -1e15, 10, 10))
    index.set('near', rect(0, 0, 10, 10))

    expect(index.query(rect(1e15, -1e15, 5, 5))).toEqual(['far'])
    expect(index.query(rect(0, 0, 5, 5))).toEqual(['near'])
  })

  it('always returns items whose span or bounds cannot be bucketed', () => {
    const index = new SpatialIndex(10)
    index.set('huge', rect(-1e9, -1e9, 2e9, 2e9))
    index.set('broken', { x: Number.NaN, y: 0, width: 10, height: 10 })
    index.set('small', rect(0, 0, 5, 5))

    expect(index.query(rect(100000, 100000, 1, 1)).sort()).toEqual(['broken', 'huge'])
    expect(index.query(rect(0, 0, 1, 1)).sort()).toEqual(['broken', 'huge', 'small'])
    expect(index.columnCandidates(100000, 100001).sort()).toEqual(['broken', 'huge'])
  })

  it('falls back to an exact scan when the query spans more cells than items', () => {
    const index = new SpatialIndex(1)
    index.set('a', rect(0, 0, 1, 1))
    index.set('b', rect(10000, 0, 1, 1))

    expect(index.query(rect(-100000, -100000, 200000, 200000)).sort()).toEqual(['a', 'b'])
    expect(index.query(rect(-100000, 50000, 200000, 1))).toEqual([])
  })

  it('answers band queries per axis', () => {
    const index = new SpatialIndex(100)
    index.set('left', rect(0, 0, 40, 40))
    index.set('right', rect(900, 0, 40, 40))
    index.set('below', rect(0, 900, 40, 40))

    expect(index.columnCandidates(0, 40).sort()).toEqual(['below', 'left'])
    expect(index.columnCandidates(900, 940)).toEqual(['right'])
    expect(index.rowCandidates(0, 40).sort()).toEqual(['left', 'right'])
    expect(index.rowCandidates(900, 940)).toEqual(['below'])
    expect(index.rowCandidates(400, 440)).toEqual([])
  })

  it('keeps items reachable through both band axes after a move', () => {
    const index = new SpatialIndex(100)
    index.set('a', rect(0, 0, 40, 40))
    index.set('a', rect(600, 600, 40, 40))

    expect(index.columnCandidates(0, 40)).toEqual([])
    expect(index.rowCandidates(0, 40)).toEqual([])
    expect(index.columnCandidates(600, 640)).toEqual(['a'])
    expect(index.rowCandidates(600, 640)).toEqual(['a'])
  })
})

function representativeStore(): SceneStore {
  const store = new SceneStore()
  const elements: Element[] = []
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      elements.push(
        createShape({
          id: `r${row}-${column}`,
          type: column % 2 === 0 ? 'rect' : 'ellipse',
          x: column * 180,
          y: row * 140,
          width: 120,
          height: 80,
        }),
      )
    }
  }
  elements.push(
    createShape({ id: 'tilted', x: 700, y: 40, width: 240, height: 40, rotation: 1.1 }),
    createShape({ id: 'locked', x: 320, y: 620, width: 100, height: 100, style: { strokeWidth: 8 } }),
    createSticky({ id: 'note', x: -300, y: 300 }),
    createText({ id: 'label', x: -280, y: 40, text: 'hello world' }),
    createFreedraw({
      id: 'scribble',
      points: [
        { x: 40, y: 620 },
        { x: 120, y: 700 },
        { x: 200, y: 640 },
      ],
    }),
    createShape({ id: 'far', x: 12000, y: 9000, width: 100, height: 100 }),
  )
  store.transact((api) => elements.forEach((element) => api.addElement(element)))
  store.transact((api) => api.updateElement('locked', { locked: true }))

  const from = store.getSnapshot().elements['r0-0']!
  const to = store.getSnapshot().elements['r2-2']!
  const startPoint = { x: from.x + from.width, y: from.y + from.height / 2 }
  const endPoint = { x: to.x, y: to.y + to.height / 2 }
  store.transact((api) =>
    api.addElement(
      createArrow({
        id: 'link',
        points: [startPoint, endPoint],
        start: createBinding(from, startPoint, 6, endPoint),
        end: createBinding(to, endPoint, 6, startPoint),
        routing: 'orthogonal',
      }),
    ),
  )
  store.transact((api) =>
    api.updateElement('link', { label: { text: 'flows into', align: 'center', verticalAlign: 'middle' } }),
  )
  store.transact((api) =>
    api.addElement(
      createArrow({
        id: 'loose-arrow',
        points: [
          { x: -200, y: 800 },
          { x: 100, y: 900 },
        ],
      }),
    ),
  )
  return store
}

function probePoints(count: number): Point[] {
  const next = random(7)
  const points: Point[] = []
  for (let i = 0; i < count; i += 1) {
    points.push({ x: -400 + next() * 1600, y: -100 + next() * 1000 })
  }
  return points
}

function culled(snapshot: SceneSnapshot, viewport: Rect): ElementId[] {
  const visible: ElementId[] = []
  for (const id of snapshot.order) {
    const element = snapshot.elements[id]
    if (!element) continue
    if (!intersects(expand(elementBounds(element), element.style.strokeWidth), viewport)) continue
    visible.push(id)
  }
  return visible
}

function otherBounds(snapshot: SceneSnapshot, exclude: ReadonlySet<ElementId>): AlignCandidate[] {
  const bounds: AlignCandidate[] = []
  for (const id of snapshot.order) {
    if (exclude.has(id)) continue
    const element = snapshot.elements[id]
    if (!element || isArrowElement(element)) continue
    bounds.push({ ...elementBounds(element), rotation: element.rotation })
  }
  return bounds
}

describe('SceneIndex parity with linear scans', () => {
  it('covers every element bound of the scene', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()

    for (const id of snapshot.order) {
      const element = snapshot.elements[id]!
      expect(store.sceneIndex.boundsOf(id)).toEqual(elementIndexBounds(element))
      expect(store.sceneIndex.candidates(elementIndexBounds(element))).toContain(id)
    }
  })

  it('keeps the scoped order a subsequence of the scene order', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()
    const scoped = store.scopedSnapshot(rect(-400, -100, 1600, 1000))

    expect(scoped.order.length).toBeLessThan(snapshot.order.length)
    expect(scoped.order).toEqual(snapshot.order.filter((id) => scoped.order.includes(id)))
    expect(scoped.elements).toBe(snapshot.elements)

    const tight = store.scopedSnapshot(rect(0, 0, 10, 10))
    expect(tight.order).toContain('r0-0')
    expect(tight.order.length).toBeLessThan(snapshot.order.length / 3)
    expect(store.scopedSnapshot(rect(6000, 6000, 10, 10)).order).toEqual([])
  })

  it('hit-tests identically through the index', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()

    for (const point of probePoints(400)) {
      for (const includeLocked of [false, true]) {
        const linear = hitTest(point, snapshot, { includeLocked })
        const indexed = hitTest(point, store.scopedSnapshot(pointRect(point)), { includeLocked })
        expect(indexed?.id ?? null).toBe(linear?.id ?? null)
      }
    }
  })

  it('marquee-selects identically through the index', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()
    const next = random(11)

    for (let i = 0; i < 120; i += 1) {
      const box = {
        x: -400 + next() * 1400,
        y: -100 + next() * 900,
        width: next() * 500,
        height: next() * 400,
      }
      const linear = marqueeHits(box, snapshot).map((element) => element.id)
      const indexed = marqueeHits(box, store.scopedSnapshot(box)).map((element) => element.id)
      expect(indexed).toEqual(linear)
    }
  })

  it('culls the viewport identically through the index', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()
    const next = random(13)

    for (let i = 0; i < 120; i += 1) {
      const viewport = {
        x: -600 + next() * 1800,
        y: -300 + next() * 1400,
        width: 100 + next() * 900,
        height: 100 + next() * 700,
      }
      expect(culled(store.scopedSnapshot(viewport), viewport)).toEqual(culled(snapshot, viewport))
    }
  })

  it('snaps arrow endpoints identically through the index', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()
    const scope = (region: Rect): SceneSnapshot => store.scopedSnapshot(region)

    for (const point of probePoints(200)) {
      const linear = snapEndpoint(point, snapshot, { threshold: 8 })
      const indexed = snapEndpoint(point, snapshot, { threshold: 8, scope })
      expect(indexed.point).toEqual(linear.point)
      expect(indexed.target?.id ?? null).toBe(linear.target?.id ?? null)
      expect(indexed.guides).toEqual(linear.guides)

      const withOrigin = { threshold: 8, origin: { x: 0, y: 0 }, ignoreId: 'link' }
      expect(snapEndpoint(point, snapshot, { ...withOrigin, scope })).toEqual(
        snapEndpoint(point, snapshot, withOrigin),
      )
    }
  })
})

describe('sceneAlignSource parity', () => {
  const spaces: { name: string; ids: ElementId[] }[] = [
    { name: 'unrotated selection', ids: ['r1-1'] },
    { name: 'multi selection', ids: ['r1-1', 'r1-2'] },
    { name: 'rotated selection', ids: ['tilted'] },
  ]

  for (const { name, ids } of spaces) {
    it(`matches the linear candidate list for a ${name}`, () => {
      const store = representativeStore()
      const snapshot = store.getSnapshot()
      const exclude = new Set(ids)
      const selected = ids.map((id) => snapshot.elements[id]!)
      const first = selected[0]!
      const space: AlignSpace = {
        center: { x: first.x + first.width / 2, y: first.y + first.height / 2 },
        rotation: selected.length === 1 ? first.rotation : 0,
      }
      const linearRects = localAlignRects(otherBounds(snapshot, exclude), space)
      const indexed = sceneAlignSource({ index: store.sceneIndex, snapshot, exclude, space })
      const next = random(17)

      expect(indexed.all()).toEqual(linearRects)

      for (let i = 0; i < 120; i += 1) {
        const moving = {
          x: -400 + next() * 1400,
          y: -200 + next() * 1000,
          width: 40 + next() * 160,
          height: 40 + next() * 120,
        }
        expect(snapMoveFrom(moving, indexed, 6)).toEqual(snapMove(moving, linearRects, 6))
        for (const edges of [
          { left: false, right: true, top: false, bottom: false },
          { left: true, right: false, top: false, bottom: true },
          { left: true, right: true, top: true, bottom: true },
        ]) {
          expect(snapResizeBoundsFrom(moving, edges, indexed, 6)).toEqual(
            snapResizeBounds(moving, edges, linearRects, 6),
          )
        }
      }
    })
  }

  it('snaps a move onto a neighbour edge through the index', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()
    const space: AlignSpace = { center: { x: 0, y: 0 }, rotation: 0 }
    const source = sceneAlignSource({
      index: store.sceneIndex,
      snapshot,
      exclude: new Set<ElementId>(),
      space,
    })

    const snap = snapMoveFrom({ x: 183, y: 3, width: 120, height: 80 }, source, 6)
    expect(snap.dx).toBe(-3)
    expect(snap.dy).toBe(-3)
    expect(snap.lines.length).toBeGreaterThan(0)
  })

  it('reuses mapped candidates until the scene changes', () => {
    const store = representativeStore()
    const space: AlignSpace = { center: { x: 0, y: 0 }, rotation: 0 }
    const source = sceneAlignSource({
      index: store.sceneIndex,
      snapshot: store.getSnapshot(),
      exclude: new Set<ElementId>(),
      space,
    })

    const first = source.all()
    expect(source.all()).toBe(first)

    store.transact((api) => api.updateElement('r0-0', { x: 4000 }))
    expect(source.all()).not.toBe(first)
  })
})

describe('spawn obstacles through the index', () => {
  it('plans the same slot from region-scoped obstacles', () => {
    const store = representativeStore()
    const snapshot = store.getSnapshot()

    for (const id of ['r0-0', 'r1-1', 'note', 'tilted']) {
      const source = snapshot.elements[id]!
      for (const direction of ['left', 'right', 'up', 'down'] as const) {
        const region = spawnSearchRegion(elementBounds(source), direction)
        const scoped = obstacleBounds(store.scopedSnapshot(region), source.id)
        const linear = obstacleBounds(snapshot, source.id)
        const style = store.getLastUsedStyle()
        expect(elementBounds(planConnectedShape(source, direction, style, undefined, scoped).target)).toEqual(
          elementBounds(planConnectedShape(source, direction, style, undefined, linear).target),
        )
      }
    }
  })
})

describe('SceneStore index maintenance', () => {
  const regions: Rect[] = [
    rect(-400, -200, 800, 600),
    rect(0, 0, 200, 200),
    rect(300, 100, 500, 500),
    rect(11900, 8900, 400, 400),
    rect(-2000, -2000, 20000, 20000),
  ]

  function expectFresh(store: SceneStore): void {
    const snapshot = store.getSnapshot()
    const reference = new SceneIndex()
    reference.rebuild(snapshot)
    for (const region of regions) {
      expect(store.sceneIndex.candidates(region)).toEqual(reference.candidates(region))
    }
    expect(store.sceneIndex.size).toBe(reference.size)
  }

  it('tracks adds, moves, restyles, reorders and deletes', () => {
    const store = representativeStore()
    expectFresh(store)

    store.transact((api) => api.addElement(createShape({ id: 'fresh', x: 5000, y: 5000, width: 60, height: 60 })))
    expectFresh(store)

    store.transact((api) => api.updateElement('fresh', { x: -1500, y: -900 }))
    expectFresh(store)

    store.transact((api) => api.updateElement('fresh', { style: { ...store.getLastUsedStyle(), strokeWidth: 40 } }))
    expectFresh(store)

    store.transact((api) => api.updateElement('tilted', { rotation: 0.2 }))
    expectFresh(store)

    store.bringToFront(['note'])
    expectFresh(store)

    store.deleteElements(['fresh', 'note'])
    expectFresh(store)
  })

  it('follows arrow bounds that move because a bound shape moved', () => {
    const store = representativeStore()
    const before = store.sceneIndex.boundsOf('link')

    store.transact((api) => api.updateElement('r2-2', { x: 900, y: 700 }))

    expect(store.sceneIndex.boundsOf('link')).not.toEqual(before)
    expectFresh(store)
  })

  it('stays fresh across undo and redo', () => {
    const store = representativeStore()
    store.transact((api) => api.updateElement('r0-0', { x: -900, y: -600 }))
    expectFresh(store)

    store.undo()
    expectFresh(store)

    store.redo()
    expectFresh(store)
  })

  it('rebuilds after an imported scene replaces the document', () => {
    const store = representativeStore()
    store.importScene({
      elements: {
        only: createShape({ id: 'only', x: 30, y: 30, width: 50, height: 50 }),
      },
      order: ['only'],
      appState: store.getSnapshot().appState,
    })

    expect(store.getSnapshot().order).toEqual(['only'])
    expectFresh(store)
  })
})
