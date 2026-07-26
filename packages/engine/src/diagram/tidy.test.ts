import { describe, expect, it } from 'vitest'
import { createArrow, createShape, createSticky, createFreedraw } from '../model/factory.js'
import { isArrowElement } from '../model/guards.js'
import { SceneStore } from '../store/scene-store.js'
import type { ArrowElement, Binding, Element, ElementId, SceneSnapshot } from '../model/types.js'
import { sceneToAst } from './scene-graph.js'
import { canTidy, planTidy, tidyDiagram } from './tidy.js'

interface NodeInit {
  id: string
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  locked?: boolean
  rotation?: number
}

function node(init: NodeInit): Element {
  const shape = createShape({
    id: init.id,
    type: 'rect',
    x: init.x,
    y: init.y,
    width: init.width ?? 120,
    height: init.height ?? 80,
    rotation: init.rotation ?? 0,
  })
  if (init.text !== undefined) shape.label = { text: init.text, align: 'center', verticalAlign: 'middle' }
  if (init.locked) shape.locked = true
  return shape
}

function bindingTo(elementId: string, side: Binding['side'] = 'right'): Binding {
  return { elementId, anchor: { nx: 0.5, ny: 0.5 }, gap: 0, side }
}

function edge(id: string, source: string | null, target: string | null, locked = false): ArrowElement {
  const arrow = createArrow({
    id,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    start: source ? bindingTo(source) : undefined,
    end: target ? bindingTo(target, 'left') : undefined,
  })
  if (locked) arrow.locked = true
  return arrow
}

function storeWith(elements: Element[]): SceneStore {
  const store = new SceneStore()
  store.transact((api) => {
    for (const element of elements) api.addElement(element)
  })
  store.stopCapturing()
  return store
}

function snapshotWith(elements: Element[]): SceneSnapshot {
  return storeWith(elements).getSnapshot()
}

function positions(snapshot: SceneSnapshot, ids: ElementId[]): Record<string, { x: number; y: number }> {
  const result: Record<string, { x: number; y: number }> = {}
  for (const id of ids) {
    const element = snapshot.elements[id]!
    result[id] = { x: element.x, y: element.y }
  }
  return result
}

function chain(): Element[] {
  return [
    node({ id: 'a', x: 400, y: 900, text: 'Start' }),
    node({ id: 'b', x: 40, y: 30, text: 'Middle' }),
    node({ id: 'c', x: 700, y: 60, text: 'End' }),
    edge('ab', 'a', 'b'),
    edge('bc', 'b', 'c'),
  ]
}

describe('sceneToAst', () => {
  it('turns bound arrows into edges and shapes into nodes', () => {
    const graph = sceneToAst(snapshotWith(chain()))

    expect(graph.ast.nodes.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
    expect(graph.ast.nodes.map((entry) => entry.text)).toEqual(['Start', 'Middle', 'End'])
    expect(graph.ast.edges.map((entry) => [entry.source, entry.target])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ])
    expect(graph.arrows.map((arrow) => arrow.id)).toEqual(['ab', 'bc'])
  })

  it('carries the arrow label and style onto the edge', () => {
    const arrow = edge('ab', 'a', 'b')
    arrow.label = { text: 'yes', align: 'center', verticalAlign: 'middle' }
    arrow.style = { ...arrow.style, strokeStyle: 'dashed', strokeWidth: 4 }
    const graph = sceneToAst(snapshotWith([node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 0, y: 200 }), arrow]))

    expect(graph.ast.edges[0]!.label).toBe('yes')
    expect(graph.ast.edges[0]!.style).toMatchObject({ strokeStyle: 'dotted', thick: true })
  })

  it('leaves out free-floating shapes, unbound arrows and non-node elements', () => {
    const graph = sceneToAst(
      snapshotWith([
        ...chain(),
        node({ id: 'loner', x: 2000, y: 2000 }),
        edge('dangling', 'a', null),
        createFreedraw({ id: 'scribble', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }),
      ]),
    )

    expect(graph.ast.nodes.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
    expect(graph.arrows.map((arrow) => arrow.id)).toEqual(['ab', 'bc'])
  })

  it('accepts stickies as nodes', () => {
    const graph = sceneToAst(
      snapshotWith([
        createSticky({ id: 's1', x: 0, y: 0 }),
        createSticky({ id: 's2', x: 0, y: 400 }),
        edge('e', 's1', 's2'),
      ]),
    )

    expect(graph.ast.nodes.map((entry) => entry.shape)).toEqual(['rect', 'rect'])
    expect(graph.ast.edges).toHaveLength(1)
  })

  it('drops locked elements and the edges that need them', () => {
    const graph = sceneToAst(
      snapshotWith([
        node({ id: 'a', x: 0, y: 0 }),
        node({ id: 'b', x: 0, y: 200, locked: true }),
        edge('ab', 'a', 'b'),
      ]),
    )

    expect(graph.ast.nodes).toEqual([])
    expect(graph.ast.edges).toEqual([])
  })

  it('ignores self-loops', () => {
    const graph = sceneToAst(snapshotWith([node({ id: 'a', x: 0, y: 0 }), edge('aa', 'a', 'a')]))

    expect(graph.ast.nodes).toEqual([])
    expect(graph.ast.edges).toEqual([])
  })

  it('restricts the graph to the component reachable from the seeds', () => {
    const graph = sceneToAst(
      snapshotWith([
        node({ id: 'a', x: 0, y: 0 }),
        node({ id: 'b', x: 0, y: 200 }),
        edge('ab', 'a', 'b'),
        node({ id: 'c', x: 900, y: 0 }),
        node({ id: 'd', x: 900, y: 200 }),
        edge('cd', 'c', 'd'),
      ]),
      { seeds: ['c'] },
    )

    expect(graph.ast.nodes.map((entry) => entry.id)).toEqual(['c', 'd'])
    expect(graph.arrows.map((arrow) => arrow.id)).toEqual(['cd'])
  })

  it('seeds from a selected arrow', () => {
    const graph = sceneToAst(snapshotWith(chain()), { seeds: ['bc'] })

    expect(graph.ast.nodes.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
  })

  it('walks the whole scene when the seed set is empty', () => {
    const graph = sceneToAst(snapshotWith(chain()), { seeds: new Set<ElementId>() })

    expect(graph.ast.nodes.map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
  })

  it('yields nothing when the seed has no connections', () => {
    const graph = sceneToAst(snapshotWith([...chain(), node({ id: 'loner', x: 5000, y: 0 })]), {
      seeds: ['loner'],
    })

    expect(graph.ast.nodes).toEqual([])
  })

  it('infers a horizontal direction from the arrow geometry', () => {
    const graph = sceneToAst(
      snapshotWith([
        node({ id: 'a', x: 0, y: 0 }),
        node({ id: 'b', x: 600, y: 0 }),
        edge('ab', 'a', 'b'),
      ]),
    )

    expect(graph.ast.direction).toBe('LR')
  })

  it('infers a vertical direction from the arrow geometry', () => {
    const graph = sceneToAst(
      snapshotWith([
        node({ id: 'a', x: 0, y: 0 }),
        node({ id: 'b', x: 0, y: 600 }),
        edge('ab', 'a', 'b'),
      ]),
    )

    expect(graph.ast.direction).toBe('TD')
  })
})

describe('canTidy', () => {
  it('rejects a scene without a connected graph', () => {
    expect(canTidy(snapshotWith([node({ id: 'a', x: 0, y: 0 }), node({ id: 'b', x: 400, y: 0 })]))).toBe(false)
  })

  it('accepts a scene with at least one bound arrow', () => {
    expect(canTidy(snapshotWith(chain()))).toBe(true)
  })

  it('rejects a selection that only holds free-floating elements', () => {
    expect(canTidy(snapshotWith([...chain(), node({ id: 'loner', x: 5000, y: 0 })]), ['loner'])).toBe(false)
  })

  it('accepts a selection that touches the graph', () => {
    expect(canTidy(snapshotWith(chain()), ['b'])).toBe(true)
  })
})

describe('planTidy', () => {
  it('keeps the element sizes and only writes positions', () => {
    const snapshot = snapshotWith(chain())
    const plan = planTidy(snapshot)

    expect(plan.moves.length).toBeGreaterThan(0)
    for (const move of plan.moves) {
      expect(Object.keys(move).sort()).toEqual(['id', 'x', 'y'])
    }
  })

  it('anchors the reflowed graph at its previous top-left corner', () => {
    const snapshot = snapshotWith(chain())
    const plan = planTidy(snapshot)
    const before = plan.nodeIds.map((id) => snapshot.elements[id]!)
    const minX = Math.min(...before.map((element) => element.x))
    const minY = Math.min(...before.map((element) => element.y))
    const moved = new Map(plan.moves.map((move) => [move.id, move]))
    const after = plan.nodeIds.map((id) => moved.get(id) ?? snapshot.elements[id]!)

    expect(Math.min(...after.map((element) => element.x))).toBe(Math.round(minX))
    expect(Math.min(...after.map((element) => element.y))).toBe(Math.round(minY))
  })

  it('spaces the layers using the real element sizes', () => {
    const snapshot = snapshotWith([
      node({ id: 'a', x: 0, y: 0, width: 100, height: 300 }),
      node({ id: 'b', x: 40, y: 20, width: 100, height: 300 }),
      edge('ab', 'a', 'b'),
    ])
    const plan = planTidy(snapshot, { direction: 'TD' })
    const moved = new Map(plan.moves.map((move) => [move.id, move]))
    const a = moved.get('a') ?? snapshot.elements.a!
    const b = moved.get('b') ?? snapshot.elements.b!

    expect(b.y - a.y).toBeGreaterThanOrEqual(300)
  })

  it('reports no moves once the graph is already tidy', () => {
    const store = storeWith(chain())
    tidyDiagram(store)

    expect(planTidy(store.getSnapshot()).moves).toEqual([])
  })

  it('returns an empty plan when there is nothing connected', () => {
    const plan = planTidy(snapshotWith([node({ id: 'a', x: 0, y: 0 })]))

    expect(plan.moves).toEqual([])
    expect(plan.nodeIds).toEqual([])
  })
})

describe('tidyDiagram', () => {
  it('rewrites the connected graph in a single undo step', () => {
    const store = storeWith(chain())
    const before = positions(store.getSnapshot(), ['a', 'b', 'c'])

    tidyDiagram(store)
    const after = positions(store.getSnapshot(), ['a', 'b', 'c'])
    expect(after).not.toEqual(before)

    store.undo()
    expect(positions(store.getSnapshot(), ['a', 'b', 'c'])).toEqual(before)

    store.undo()
    expect(store.getSnapshot().order).toEqual([])
  })

  it('never moves free-floating elements', () => {
    const store = storeWith([...chain(), node({ id: 'loner', x: 2500, y: 1500 })])

    tidyDiagram(store)

    expect(positions(store.getSnapshot(), ['loner'])).toEqual({ loner: { x: 2500, y: 1500 } })
  })

  it('leaves the component outside the selection alone', () => {
    const store = storeWith([
      ...chain(),
      node({ id: 'x', x: 3000, y: 900 }),
      node({ id: 'y', x: 3400, y: 40 }),
      edge('xy', 'x', 'y'),
    ])
    const before = positions(store.getSnapshot(), ['x', 'y'])

    tidyDiagram(store, { seeds: ['a'] })

    expect(positions(store.getSnapshot(), ['x', 'y'])).toEqual(before)
    expect(positions(store.getSnapshot(), ['a'])).not.toEqual({ a: { x: 400, y: 900 } })
  })

  it('preserves element identity, z-order and bindings', () => {
    const store = storeWith(chain())
    const order = [...store.getSnapshot().order]

    tidyDiagram(store)
    const snapshot = store.getSnapshot()

    expect(snapshot.order).toEqual(order)
    expect([...store.arrowsForShape('b')].sort()).toEqual(['ab', 'bc'])
    const arrow = snapshot.elements.ab!
    expect(isArrowElement(arrow) && arrow.start?.elementId).toBe('a')
    expect(isArrowElement(arrow) && arrow.end?.elementId).toBe('b')
  })

  it('re-routes bound connectors onto the new positions', () => {
    const store = storeWith(chain())

    tidyDiagram(store)
    const snapshot = store.getSnapshot()
    const arrow = snapshot.elements.ab!
    if (!isArrowElement(arrow)) throw new Error('expected an arrow')
    const a = snapshot.elements.a!
    const b = snapshot.elements.b!
    const first = arrow.route[0]!
    const last = arrow.route[arrow.route.length - 1]!

    expect(near(first, a)).toBe(true)
    expect(near(last, b)).toBe(true)
  })

  it('is a no-op when the graph is already tidy', () => {
    const store = storeWith(chain())
    tidyDiagram(store)
    const settled = positions(store.getSnapshot(), ['a', 'b', 'c'])

    const plan = tidyDiagram(store)

    expect(plan.moves).toEqual([])
    expect(positions(store.getSnapshot(), ['a', 'b', 'c'])).toEqual(settled)
  })

  it('does nothing at all when the scene has no connected graph', () => {
    const store = storeWith([node({ id: 'a', x: 0, y: 0 })])

    expect(tidyDiagram(store).moves).toEqual([])

    store.undo()
    expect(store.getSnapshot().order).toEqual([])
  })
})

function near(point: { x: number; y: number }, element: Element, slack = 40): boolean {
  return (
    point.x >= element.x - slack &&
    point.x <= element.x + element.width + slack &&
    point.y >= element.y - slack &&
    point.y <= element.y + element.height + slack
  )
}
