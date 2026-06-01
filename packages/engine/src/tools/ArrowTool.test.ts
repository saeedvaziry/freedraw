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
    setMarquee: () => {},
    setGuides: () => {},
    setPortTarget: () => {},
    beginEdit: () => {},
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
    expect(elements[0]).toMatchObject({ type: 'arrow', points: [{ x: 0, y: 0 }, { x: 100, y: 40 }] })
    expect(store.getUiState().activeTool).toBe('select')
    expect(store.getUiState().selectedIds).toEqual(new Set([elements[0]!.id]))
    expect(getPreview()).toBeNull()
  })
})
