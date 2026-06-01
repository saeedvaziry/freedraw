import { describe, expect, it } from 'vitest'
import { dragBounds, ShapeTool } from './ShapeTool.js'
import { Camera } from '../geometry/Camera.js'
import { SceneStore } from '../store/SceneStore.js'
import type { Element } from '../model/types.js'
import type { PointerInfo, ToolContext } from './Tool.js'

function pointer(world: { x: number; y: number }, shiftKey = false): PointerInfo {
  return {
    world,
    screen: world,
    shiftKey,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    button: 0,
  }
}

function makeContext() {
  const store = new SceneStore()
  let preview: Element | null = null
  const ctx: ToolContext = {
    store,
    camera: new Camera(),
    setPreview: (element) => {
      preview = element
    },
    setMarquee: () => {},
    setGuides: () => {},
    setPortTarget: () => {},
    beginEdit: () => {},
  }
  return { store, ctx, getPreview: () => preview }
}

describe('dragBounds', () => {
  it('computes a normalized rect dragging down-right', () => {
    expect(dragBounds({ x: 10, y: 20 }, { x: 110, y: 80 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 60,
    })
  })

  it('normalizes a drag up-left to a positive rect', () => {
    expect(dragBounds({ x: 100, y: 100 }, { x: 40, y: 60 })).toEqual({
      x: 40,
      y: 60,
      width: 60,
      height: 40,
    })
  })

  it('constrains to a square with shift', () => {
    const rect = dragBounds({ x: 0, y: 0 }, { x: 120, y: 40 }, true)
    expect(rect.width).toBe(rect.height)
    expect(rect.width).toBe(120)
  })
})

describe('ShapeTool', () => {
  it('previews the in-progress shape on move without committing', () => {
    const { ctx, store, getPreview } = makeContext()
    const tool = new ShapeTool('diamond')
    tool.onPointerDown(pointer({ x: 10, y: 10 }))
    tool.onPointerMove(pointer({ x: 90, y: 70 }), ctx)

    const preview = getPreview()
    expect(preview).toMatchObject({ type: 'diamond', x: 10, y: 10, width: 80, height: 60 })
    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(0)
  })

  it('commits the element at the dragged bounds on pointer up', () => {
    const { ctx, store, getPreview } = makeContext()
    const tool = new ShapeTool('ellipse')
    tool.onPointerDown(pointer({ x: 0, y: 0 }))
    tool.onPointerMove(pointer({ x: 200, y: 120 }), ctx)
    tool.onPointerUp(pointer({ x: 200, y: 120 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({ type: 'ellipse', x: 0, y: 0, width: 200, height: 120 })
    expect(store.getUiState().activeTool).toBe('select')
    expect(store.getUiState().selectedIds).toEqual(new Set([elements[0]!.id]))
    expect(getPreview()).toBeNull()
  })

  it('does not commit a click without a meaningful drag', () => {
    const { ctx, store } = makeContext()
    const tool = new ShapeTool('rect')
    tool.onPointerDown(pointer({ x: 50, y: 50 }))
    tool.onPointerUp(pointer({ x: 51, y: 51 }), ctx)
    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(0)
  })
})
