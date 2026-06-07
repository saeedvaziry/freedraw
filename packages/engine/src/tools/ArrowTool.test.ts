import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/Camera.js'
import { SceneStore } from '../store/SceneStore.js'
import type { Element } from '../model/types.js'
import type { PointerInfo, ToolContext } from './Tool.js'
import { ArrowTool } from './ArrowTool.js'

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
  let preview: Element | null = null
  const ctx: ToolContext = {
    store,
    camera: new Camera(),
    setPreview: (element) => {
      preview = element
    },
    setSpawnPreview: () => {},
    setMarquee: () => {},
    setGuides: () => {},
    setPortTarget: () => {},
    beginEdit: () => {},
    requestSpawnMenu: () => {},
  }
  return { store, ctx, getPreview: () => preview }
}

describe('ArrowTool', () => {
  it('commits the arrow and switches back to select', () => {
    const { ctx, store, getPreview } = makeContext()
    const tool = new ArrowTool('arrow')
    store.setUiState({ activeTool: 'arrow' })

    tool.onPointerDown(pointer({ x: 0, y: 0 }), ctx)
    tool.onPointerMove(pointer({ x: 100, y: 40 }), ctx)
    tool.onPointerUp(pointer({ x: 100, y: 40 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({
      type: 'arrow',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 40 },
      ],
      route: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 40 },
      ],
    })
    expect(store.getUiState().activeTool).toBe('select')
    expect(store.getUiState().selectedIds).toEqual(new Set([elements[0]!.id]))
    expect(getPreview()).toBeNull()
  })

  it('snaps arrow endpoints to half-grid guides on empty canvas', () => {
    const { ctx, store } = makeContext()
    const tool = new ArrowTool('line')

    tool.onPointerDown(pointer({ x: 13, y: 17 }), ctx)
    tool.onPointerMove(pointer({ x: 113, y: 43 }), ctx)
    tool.onPointerUp(pointer({ x: 113, y: 43 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements[0]).toMatchObject({
      type: 'line',
      points: [
        { x: 15, y: 15 },
        { x: 115, y: 15 },
      ],
      route: [
        { x: 15, y: 15 },
        { x: 115, y: 15 },
      ],
    })
  })

  it('commits one grid cell when the snapped drag spans a cell', () => {
    const { ctx, store } = makeContext()
    const tool = new ArrowTool('line')

    tool.onPointerDown(pointer({ x: 2, y: 2 }), ctx)
    tool.onPointerMove(pointer({ x: 8, y: 8 }), ctx)
    tool.onPointerUp(pointer({ x: 8, y: 8 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      route: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    })
  })

  it('does not commit an arrow below one grid cell', () => {
    const { ctx, store } = makeContext()
    const tool = new ArrowTool('arrow')

    tool.onPointerDown(pointer({ x: 13, y: 13 }), ctx)
    tool.onPointerMove(pointer({ x: 14, y: 14 }), ctx)
    tool.onPointerUp(pointer({ x: 14, y: 14 }), ctx)

    expect(Object.values(store.getSnapshot().elements)).toHaveLength(0)
  })
})
