import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/Camera.js'
import { createBinding } from '../connectors/binding.js'
import { createArrow, createShape } from '../model/factory.js'
import { SceneStore } from '../store/SceneStore.js'
import type { ArrowElement, Element } from '../model/types.js'
import type { PointerInfo, ToolContext } from './Tool.js'
import { SelectTool } from './SelectTool.js'

function pointer(world: { x: number; y: number }): PointerInfo {
  return {
    world,
    screen: world,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    button: 0,
  }
}

function makeContext() {
  const store = new SceneStore()
  const ctx: ToolContext = {
    store,
    camera: new Camera(),
    setPreview: () => {},
    setMarquee: () => {},
    setGuides: () => {},
    setPortTarget: () => {},
    beginEdit: () => {},
  }
  return { store, ctx }
}

function allAxisAligned(points: { x: number; y: number }[]): boolean {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) return false
  }
  return true
}

describe('SelectTool', () => {
  it('moves selected shapes in board grid steps', () => {
    const { ctx, store } = makeContext()
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 100 })
    store.transact((api) => api.addElement(shape))
    const tool = new SelectTool()

    tool.onPointerDown(pointer({ x: 50, y: 50 }), ctx)
    tool.onPointerMove(pointer({ x: 70, y: 70 }), ctx)
    tool.onPointerUp(pointer({ x: 70, y: 70 }), ctx)

    expect(store.getSnapshot().elements.shape).toMatchObject({ x: 20, y: 20 })
  })

  it('moves arrow points in board grid steps', () => {
    const { ctx, store } = makeContext()
    const arrow = createArrow({
      id: 'arrow',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    })
    store.transact((api) => api.addElement(arrow))
    const tool = new SelectTool()

    tool.onPointerDown(pointer({ x: 50, y: 0 }), ctx)
    tool.onPointerMove(pointer({ x: 70, y: 0 }), ctx)
    tool.onPointerUp(pointer({ x: 70, y: 0 }), ctx)

    const moved = store.getSnapshot().elements.arrow as Element
    expect(moved).toMatchObject({
      x: 20,
      y: 0,
      width: 100,
      height: 0,
      points: [
        { x: 20, y: 0 },
        { x: 120, y: 0 },
      ],
    })
  })

  it('moves a multi-segment arrow through store-owned route recompute', () => {
    const { ctx, store } = makeContext()
    const arrow = createArrow({
      id: 'arrow',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
    })
    store.transact((api) => api.addElement(arrow))
    const tool = new SelectTool()

    tool.onPointerDown(pointer({ x: 100, y: 50 }), ctx)
    tool.onPointerMove(pointer({ x: 120, y: 70 }), ctx)
    tool.onPointerUp(pointer({ x: 120, y: 70 }), ctx)

    const moved = store.getSnapshot().elements.arrow as ArrowElement
    const expected = [
      { x: 20, y: 20 },
      { x: 120, y: 20 },
      { x: 120, y: 120 },
      { x: 220, y: 120 },
    ]
    expect(moved.points).toEqual(expected)
    expect(moved.route).toEqual(expected)
    expect(moved).toMatchObject({ x: 20, y: 20, width: 200, height: 100 })
  })

  it('starts a new arrow from a port of a shape that already has an arrow', () => {
    const { ctx, store } = makeContext()
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 0, width: 100, height: 100 })
    const arrow = createArrow({
      id: 'arrow',
      points: [
        { x: 100, y: 50 },
        { x: 300, y: 50 },
      ],
      start: createBinding(a, { x: 100, y: 50 }, 0),
      end: createBinding(b, { x: 300, y: 50 }, 0),
    })
    store.transact((api) => {
      api.addElement(a)
      api.addElement(b)
      api.addElement(arrow)
    })
    store.setUiState({ selectedIds: new Set(['arrow']), hoveredId: null })
    const tool = new SelectTool()

    tool.onPointerDown(pointer({ x: 100, y: 50 }), ctx)
    tool.onPointerMove(pointer({ x: 80, y: 200 }), ctx)
    tool.onPointerUp(pointer({ x: 80, y: 200 }), ctx)

    const arrows = Object.values(store.getSnapshot().elements).filter(
      (element): element is ArrowElement => element.type === 'arrow' || element.type === 'line',
    )
    expect(arrows).toHaveLength(2)
    const original = store.getSnapshot().elements.arrow as ArrowElement
    expect(original.start?.elementId).toBe('a')
    expect(original.end?.elementId).toBe('b')
    const created = arrows.find((element) => element.id !== 'arrow')!
    expect(created.start?.elementId).toBe('a')
  })

  it('keeps route segment reshaping orthogonal across repeated drag updates', () => {
    const { ctx, store } = makeContext()
    const arrow = createArrow({
      id: 'arrow',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    })
    store.transact((api) => api.addElement(arrow))
    store.setUiState({ selectedIds: new Set(['arrow']) })
    const tool = new SelectTool()

    tool.onPointerDown(pointer({ x: 50, y: 0 }), ctx)
    tool.onPointerMove(pointer({ x: 50, y: 40 }), ctx)
    tool.onPointerMove(pointer({ x: 60, y: 50 }), ctx)
    tool.onPointerUp(pointer({ x: 60, y: 50 }), ctx)

    const reshaped = store.getSnapshot().elements.arrow as ArrowElement
    expect(reshaped.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 0 },
    ])
    expect(reshaped.route).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 0 },
    ])
    expect(reshaped.route).not.toContainEqual({ x: 50, y: 40 })
    expect(allAxisAligned(reshaped.route)).toBe(true)
  })

  it('moves the route segment represented by the midpoint handle', () => {
    const { ctx, store } = makeContext()
    const arrow = createArrow({
      id: 'arrow',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
    })
    store.transact((api) => api.addElement(arrow))
    store.setUiState({ selectedIds: new Set(['arrow']) })
    const tool = new SelectTool()

    tool.onPointerDown(pointer({ x: 100, y: 50 }), ctx)
    tool.onPointerMove(pointer({ x: 140, y: 50 }), ctx)
    tool.onPointerUp(pointer({ x: 140, y: 50 }), ctx)

    const reshaped = store.getSnapshot().elements.arrow as ArrowElement
    const expected = [
      { x: 0, y: 0 },
      { x: 140, y: 0 },
      { x: 140, y: 100 },
      { x: 200, y: 100 },
    ]
    expect(reshaped.points).toEqual(expected)
    expect(reshaped.route).toEqual(expected)
  })

  it('moves a rendered route segment when source points do not contain that segment', () => {
    const { ctx, store } = makeContext()
    const arrow = createArrow({
      id: 'arrow',
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 100 },
      ],
    })
    store.transact((api) => api.addElement(arrow))
    store.setUiState({ selectedIds: new Set(['arrow']) })
    const tool = new SelectTool()

    tool.onPointerDown(pointer({ x: 200, y: 50 }), ctx)
    tool.onPointerMove(pointer({ x: 160, y: 50 }), ctx)
    tool.onPointerUp(pointer({ x: 160, y: 50 }), ctx)

    const reshaped = store.getSnapshot().elements.arrow as ArrowElement
    const expected = [
      { x: 0, y: 0 },
      { x: 160, y: 0 },
      { x: 160, y: 100 },
      { x: 200, y: 100 },
    ]
    expect(reshaped.points).toEqual(expected)
    expect(reshaped.route).toEqual(expected)
  })
})
