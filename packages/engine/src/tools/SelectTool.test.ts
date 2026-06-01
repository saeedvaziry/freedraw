import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/Camera.js'
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

  it('keeps midpoint reshaping orthogonal across repeated drag updates', () => {
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
    expect(reshaped).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 60, y: 50 },
        { x: 100, y: 50 },
        { x: 100, y: 0 },
      ],
    })
    expect(reshaped.points).not.toContainEqual({ x: 50, y: 40 })
    expect(allAxisAligned(reshaped.points)).toBe(true)
  })
})
