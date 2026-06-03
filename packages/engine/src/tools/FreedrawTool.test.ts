import { describe, expect, it } from 'vitest'
import { FreedrawTool } from './FreedrawTool.js'
import { Camera } from '../geometry/Camera.js'
import { SceneStore } from '../store/SceneStore.js'
import type { Element, FreedrawElement } from '../model/types.js'
import type { PointerInfo, ToolContext } from './Tool.js'

function pointer(world: { x: number; y: number }, button = 0): PointerInfo {
  return {
    world,
    screen: world,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    button,
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

describe('FreedrawTool', () => {
  it('previews the in-progress stroke while drawing', () => {
    const { ctx, store, getPreview } = makeContext()
    const tool = new FreedrawTool()
    tool.onPointerDown(pointer({ x: 10, y: 10 }), ctx)
    tool.onPointerMove(pointer({ x: 20, y: 30 }), ctx)

    expect(getPreview()).toMatchObject({ type: 'freedraw' })
    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(0)
  })

  it('commits a freedraw element and stays in draw mode for the next stroke', () => {
    const { ctx, store, getPreview } = makeContext()
    store.setUiState({ activeTool: 'freedraw' })
    const tool = new FreedrawTool()
    tool.onPointerDown(pointer({ x: 10, y: 10 }), ctx)
    tool.onPointerMove(pointer({ x: 20, y: 30 }), ctx)
    tool.onPointerMove(pointer({ x: 40, y: 5 }), ctx)
    tool.onPointerUp(pointer({ x: 40, y: 5 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    const element = elements[0] as FreedrawElement
    expect(element.type).toBe('freedraw')
    expect(element.points).toEqual([
      { x: 10, y: 10 },
      { x: 20, y: 30 },
      { x: 40, y: 5 },
    ])
    expect(element).toMatchObject({ x: 10, y: 5, width: 30, height: 25 })
    expect(store.getUiState().activeTool).toBe('freedraw')
    expect(store.getUiState().selectedIds.size).toBe(0)
    expect(getPreview()).toBeNull()
  })

  it('discards a stroke with too few points', () => {
    const { ctx, store } = makeContext()
    const tool = new FreedrawTool()
    tool.onPointerDown(pointer({ x: 10, y: 10 }), ctx)
    tool.onPointerUp(pointer({ x: 10, y: 10 }), ctx)

    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(0)
  })

  it('ignores non-primary buttons', () => {
    const { ctx, store } = makeContext()
    const tool = new FreedrawTool()
    tool.onPointerDown(pointer({ x: 10, y: 10 }, 2), ctx)
    tool.onPointerMove(pointer({ x: 20, y: 30 }), ctx)
    tool.onPointerUp(pointer({ x: 20, y: 30 }), ctx)

    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(0)
  })

  it('clears the in-progress stroke on deactivate', () => {
    const { ctx, getPreview } = makeContext()
    const tool = new FreedrawTool()
    tool.onPointerDown(pointer({ x: 10, y: 10 }), ctx)
    tool.onDeactivate(ctx)

    expect(getPreview()).toBeNull()
  })
})
