import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/camera.js'
import type { Point } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import type { EditRequest } from '../text/edit.js'
import { ShapeTool } from './shape-tool.js'
import { StickyTool } from './sticky-tool.js'
import { TextTool } from './text-tool.js'
import type { PointerInfo, ToolContext } from './tool.js'

const camera = new Camera({ x: 0, y: 0, zoom: 1 })

function pointerAt(point: Point): PointerInfo {
  return {
    screen: point,
    world: point,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    button: 0,
  }
}

function setup(toolLock: boolean): { store: SceneStore; ctx: ToolContext; edits: EditRequest[] } {
  const store = new SceneStore()
  store.setUiState({ toolLock })
  const edits: EditRequest[] = []
  return {
    store,
    edits,
    ctx: {
      store,
      camera,
      setPreview: () => {},
      setSpawnPreview: () => {},
      setMarquee: () => {},
      setGuides: () => {},
      setPortTarget: () => {},
      beginEdit: (request) => {
        edits.push(request)
      },
      spawnChildAndEdit: () => {},
    },
  }
}

describe('shape tool with tool lock', () => {
  it('creates without entering label edit and keeps the tool active', () => {
    const { store, ctx, edits } = setup(true)
    store.setUiState({ activeTool: 'shape' })
    const tool = new ShapeTool('rect')

    tool.onPointerDown(pointerAt({ x: 0, y: 0 }), ctx)
    tool.onPointerUp(pointerAt({ x: 120, y: 80 }), ctx)

    const ui = store.getUiState()
    expect(edits).toHaveLength(0)
    expect(ui.activeTool).toBe('shape')
    expect(ui.selectedIds.size).toBe(1)
    expect(store.getSnapshot().order).toHaveLength(1)
  })

  it('supports repeated creation while locked', () => {
    const { store, ctx, edits } = setup(true)
    store.setUiState({ activeTool: 'shape' })
    const tool = new ShapeTool('rect')

    tool.onPointerDown(pointerAt({ x: 0, y: 0 }), ctx)
    tool.onPointerUp(pointerAt({ x: 120, y: 80 }), ctx)
    tool.onPointerDown(pointerAt({ x: 200, y: 0 }), ctx)
    tool.onPointerUp(pointerAt({ x: 320, y: 80 }), ctx)

    expect(edits).toHaveLength(0)
    expect(store.getSnapshot().order).toHaveLength(2)
    expect(store.getUiState().activeTool).toBe('shape')
  })

  it('enters label edit and falls back to select when unlocked', () => {
    const { store, ctx, edits } = setup(false)
    store.setUiState({ activeTool: 'shape' })
    const tool = new ShapeTool('rect')

    tool.onPointerDown(pointerAt({ x: 0, y: 0 }), ctx)
    tool.onPointerUp(pointerAt({ x: 120, y: 80 }), ctx)

    expect(edits).toHaveLength(1)
    expect(edits[0]?.target).toBe('label')
    expect(store.getUiState().activeTool).toBe('select')
  })
})

describe('sticky tool with tool lock', () => {
  it('creates without entering label edit and keeps the tool active', () => {
    const { store, ctx, edits } = setup(true)
    store.setUiState({ activeTool: 'sticky' })
    const tool = new StickyTool()

    tool.onPointerDown(pointerAt({ x: 0, y: 0 }))
    tool.onPointerUp(pointerAt({ x: 0, y: 0 }), ctx)

    const ui = store.getUiState()
    expect(edits).toHaveLength(0)
    expect(ui.activeTool).toBe('sticky')
    expect(ui.selectedIds.size).toBe(1)
  })

  it('enters label edit and falls back to select when unlocked', () => {
    const { store, ctx, edits } = setup(false)
    store.setUiState({ activeTool: 'sticky' })
    const tool = new StickyTool()

    tool.onPointerDown(pointerAt({ x: 0, y: 0 }))
    tool.onPointerUp(pointerAt({ x: 0, y: 0 }), ctx)

    expect(edits).toHaveLength(1)
    expect(edits[0]?.target).toBe('label')
    expect(store.getUiState().activeTool).toBe('select')
  })
})

describe('text tool with tool lock', () => {
  it('still opens the text editor because an empty text element has no content', () => {
    const { store, ctx, edits } = setup(true)
    store.setUiState({ activeTool: 'text' })
    const tool = new TextTool()

    tool.onPointerDown(pointerAt({ x: 0, y: 0 }), ctx)

    expect(edits).toHaveLength(1)
    expect(edits[0]?.target).toBe('text')
    expect(store.getUiState().activeTool).toBe('text')
  })

  it('falls back to select when unlocked', () => {
    const { store, ctx, edits } = setup(false)
    store.setUiState({ activeTool: 'text' })
    const tool = new TextTool()

    tool.onPointerDown(pointerAt({ x: 0, y: 0 }), ctx)

    expect(edits).toHaveLength(1)
    expect(store.getUiState().activeTool).toBe('select')
  })
})
