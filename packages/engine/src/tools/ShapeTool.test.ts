import { describe, expect, it } from 'vitest'
import { ShapeTool } from './ShapeTool.js'
import { Camera } from '../geometry/Camera.js'
import { SceneStore } from '../store/SceneStore.js'
import type { Element } from '../model/types.js'
import type { EditRequest } from '../text/edit.js'
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
  let edit: EditRequest | null = null
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
    beginEdit: (request) => {
      edit = request
    },
    requestSpawnMenu: () => {},
  }
  return { store, ctx, getPreview: () => preview, getEdit: () => edit }
}

describe('ShapeTool', () => {
  it('previews a default-sized ghost centered on the cursor', () => {
    const { ctx, store, getPreview } = makeContext()
    const tool = new ShapeTool('diamond')
    tool.onPointerMove(pointer({ x: 100, y: 100 }), ctx)

    expect(getPreview()).toMatchObject({ type: 'diamond', x: 40, y: 60, width: 120, height: 80 })
    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(0)
  })

  it('places a default-sized shape on click and selects it', () => {
    const { ctx, store, getPreview } = makeContext()
    const tool = new ShapeTool('ellipse')
    tool.onPointerDown(pointer({ x: 100, y: 100 }), ctx)
    tool.onPointerUp(pointer({ x: 100, y: 100 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({ type: 'ellipse', x: 40, y: 60, width: 120, height: 80 })
    expect(store.getUiState().activeTool).toBe('select')
    expect(store.getUiState().selectedIds).toEqual(new Set([elements[0]!.id]))
    expect(getPreview()).toBeNull()
  })

  it('draws a shape to the dragged bounds', () => {
    const { ctx, store } = makeContext()
    const tool = new ShapeTool('rect')
    tool.onPointerDown(pointer({ x: 100, y: 100 }), ctx)
    tool.onPointerMove(pointer({ x: 300, y: 250 }), ctx)
    tool.onPointerUp(pointer({ x: 300, y: 250 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({ type: 'rect', x: 100, y: 100, width: 200, height: 150 })
  })

  it('normalizes bounds when dragging up and to the left', () => {
    const { ctx, store } = makeContext()
    const tool = new ShapeTool('rect')
    tool.onPointerDown(pointer({ x: 300, y: 250 }), ctx)
    tool.onPointerUp(pointer({ x: 100, y: 100 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements[0]).toMatchObject({ x: 100, y: 100, width: 200, height: 150 })
  })

  it('begins editing the label of the placed shape', () => {
    const { ctx, store, getEdit } = makeContext()
    const tool = new ShapeTool('rect')
    tool.onPointerDown(pointer({ x: 100, y: 100 }), ctx)
    tool.onPointerUp(pointer({ x: 100, y: 100 }), ctx)

    const element = Object.values(store.getSnapshot().elements)[0]!
    expect(getEdit()).toMatchObject({ elementId: element.id, target: 'label', text: '' })
  })

  it('ignores non-primary buttons', () => {
    const { ctx, store } = makeContext()
    const tool = new ShapeTool('rect')
    tool.onPointerDown(pointer({ x: 100, y: 100 }, 2), ctx)
    expect(Object.keys(store.getSnapshot().elements)).toHaveLength(0)
  })

  it('clears the preview on deactivate', () => {
    const { ctx, getPreview } = makeContext()
    const tool = new ShapeTool('rect')
    tool.onPointerMove(pointer({ x: 100, y: 100 }), ctx)
    tool.onDeactivate(ctx)
    expect(getPreview()).toBeNull()
  })
})
