import { describe, expect, it } from 'vitest'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement, Element, ElementId, Point } from '../model/types.js'
import { Camera } from '../geometry/camera.js'
import { arrowHandlesScreen } from '../render/overlay/arrow-handles.js'
import { SceneStore } from '../store/scene-store.js'
import { createBinding } from './binding.js'
import { resolveArrowPoints } from './resolve.js'

interface TestRect {
  x: number
  y: number
  width: number
  height: number
}

function record(elements: Element[]): Record<ElementId, Element> {
  return Object.fromEntries(elements.map((element) => [element.id, element]))
}

function connectedArrow(source: Element, target: Element): ArrowElement {
  const start = { x: source.x + source.width, y: source.y + source.height / 2 }
  const end = { x: target.x, y: target.y + target.height / 2 }
  return createArrow({
    id: 'arrow',
    points: [start, end],
    start: createBinding(source, start, 0, end),
    end: createBinding(target, end, 0, start),
    routing: 'orthogonal',
  })
}

function connectedArrowFromLeftSide(source: Element, target: Element): ArrowElement {
  const start = { x: source.x, y: source.y + source.height / 2 }
  const end = { x: target.x, y: target.y + target.height / 2 }
  return createArrow({
    id: 'arrow',
    points: [start, end],
    start: createBinding(source, start, 0, end),
    end: createBinding(target, end, 0, start),
    routing: 'orthogonal',
  })
}

function connectedArrowToTopSide(source: Element, target: Element): ArrowElement {
  const start = { x: target.x, y: target.y + target.height / 2 }
  const end = { x: source.x + source.width / 2, y: source.y }
  return createArrow({
    id: 'arrow',
    points: [start, end],
    start: createBinding(target, start, 0, end),
    end: createBinding(source, end, 0, start),
    routing: 'orthogonal',
  })
}

function crossesRect(route: Point[], rect: TestRect): boolean {
  return route.some((point, index) => {
    const next = route[index + 1]
    if (!next) return false
    if (Math.abs(point.y - next.y) < 0.001) {
      const y = point.y
      return (
        y > rect.y &&
        y < rect.y + rect.height &&
        Math.max(Math.min(point.x, next.x), rect.x) < Math.min(Math.max(point.x, next.x), rect.x + rect.width)
      )
    }
    if (Math.abs(point.x - next.x) < 0.001) {
      const x = point.x
      return (
        x > rect.x &&
        x < rect.x + rect.width &&
        Math.max(Math.min(point.y, next.y), rect.y) < Math.min(Math.max(point.y, next.y), rect.y + rect.height)
      )
    }
    return false
  })
}

describe('resolveArrowPoints', () => {
  it('leaves free straight arrows untouched', () => {
    const arrow = createArrow({
      id: 'arrow',
      points: [
        { x: 0, y: 0 },
        { x: 120, y: 80 },
      ],
      routing: 'straight',
    })

    const route = resolveArrowPoints(arrow, record([arrow]))

    expect(route).toEqual(arrow.points)
  })

  it('keeps connected arrows straight when no third shape is in the way', () => {
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const arrow = connectedArrow(source, target)

    const route = resolveArrowPoints(arrow, record([source, target, arrow]))

    expect(route).toHaveLength(2)
    expect(route[0]!.y).toBeCloseTo(30)
    expect(route[1]!.y).toBeCloseTo(30)
  })

  it('adds the smallest detour around a third shape crossing the connection', () => {
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const blocker = createShape({ id: 'blocker', x: 180, y: 10, width: 40, height: 60 })
    const arrow = connectedArrow(source, target)

    const route = resolveArrowPoints(arrow, record([source, target, blocker, arrow]))

    expect(route.length).toBeGreaterThan(2)
    expect(Math.min(...route.map((point) => point.y))).toBeLessThan(blocker.y)
    expect(crossesRect(route, blocker)).toBe(false)
  })

  it('bends around a connected endpoint shape instead of crossing through it', () => {
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const arrow = connectedArrowFromLeftSide(source, target)

    const route = resolveArrowPoints(arrow, record([source, target, arrow]))

    expect(route.length).toBeGreaterThan(2)
    expect(crossesRect(route, source)).toBe(false)
  })

  it('approaches a connected top-side endpoint from outside the shape', () => {
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const arrow = connectedArrowToTopSide(source, target)

    const route = resolveArrowPoints(arrow, record([source, target, arrow]))

    expect(crossesRect(route, source)).toBe(false)
    expect(Math.min(...route.map((point) => point.y))).toBeLessThan(source.y)
  })

  it('ignores stored interior waypoints on connected arrows', () => {
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const start = { x: source.x + source.width / 2, y: source.y }
    const end = { x: target.x, y: target.y + target.height / 2 }
    const arrow = createArrow({
      id: 'arrow',
      points: [
        start,
        { x: start.x, y: source.y + source.height / 2 },
        { x: source.x + source.width, y: source.y + source.height / 2 },
        end,
      ],
      start: createBinding(source, start, 0, end),
      end: createBinding(target, end, 0, start),
      routing: 'orthogonal',
    })

    const route = resolveArrowPoints(arrow, record([source, target, arrow]))

    expect(crossesRect(route, source)).toBe(false)
  })

  it('recalculates an existing connected arrow when a new shape is placed under it', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const arrow = connectedArrow(source, target)
    const blocker = createShape({ id: 'blocker', x: 180, y: 10, width: 40, height: 60 })

    store.transact((api) => {
      api.addElement(source)
      api.addElement(target)
      api.addElement(arrow)
    })
    expect((store.getSnapshot().elements.arrow as ArrowElement).route).toHaveLength(2)

    store.transact((api) => api.addElement(blocker))
    const rerouted = store.getSnapshot().elements.arrow as ArrowElement

    expect(rerouted.route.length).toBeGreaterThan(2)
    expect(crossesRect(rerouted.route, blocker)).toBe(false)
    const persisted = store.doc.getMap('elements').get('arrow') as { get(key: string): unknown }
    expect(persisted.get('route')).toBeUndefined()
  })

  it('canonicalizes existing connected arrow points back to endpoints', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const start = { x: source.x + source.width / 2, y: source.y }
    const end = { x: target.x, y: target.y + target.height / 2 }
    const arrow = createArrow({
      id: 'arrow',
      points: [
        start,
        { x: start.x, y: source.y + source.height / 2 },
        { x: source.x + source.width, y: source.y + source.height / 2 },
        end,
      ],
      start: createBinding(source, start, 0, end),
      end: createBinding(target, end, 0, start),
      routing: 'orthogonal',
    })

    store.transact((api) => {
      api.addElement(source)
      api.addElement(target)
      api.addElement(arrow)
    })
    const resolved = store.getSnapshot().elements.arrow as ArrowElement

    expect(resolved.points).toHaveLength(2)
    expect(crossesRect(resolved.route, source)).toBe(false)
  })

  it('exposes midpoint handles for connected arrows', () => {
    const source = createShape({ id: 'source', x: 0, y: 0, width: 100, height: 60 })
    const target = createShape({ id: 'target', x: 300, y: 0, width: 100, height: 60 })
    const arrow = connectedArrowToTopSide(source, target)
    const route = resolveArrowPoints(arrow, record([source, target, arrow]))

    const handles = arrowHandlesScreen({ ...arrow, route }, new Camera({ x: 0, y: 0, zoom: 1 }))

    expect(handles.map((handle) => handle.id)).toContain('midpoint')
  })
})
