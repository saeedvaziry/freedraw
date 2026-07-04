import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/camera.js'
import { createShape } from '../model/factory.js'
import type { ArrowElement, Element, Point } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import type { PointerInfo, ToolContext } from './tool.js'
import { SelectTool } from './select-tool.js'

const camera = new Camera({ x: 0, y: 0, zoom: 1 })

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow'
}

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

function setup(): { store: SceneStore; ctx: ToolContext } {
  const store = new SceneStore()
  const shape = createShape({
    id: 'shape-1',
    type: 'rect',
    x: 0,
    y: 0,
    width: 120,
    height: 80,
  })

  store.transact((api) => api.addElement(shape))

  return {
    store,
    ctx: {
      store,
      camera,
      setPreview: () => {},
      setSpawnPreview: () => {},
      setMarquee: () => {},
      setGuides: () => {},
      setPortTarget: () => {},
      beginEdit: () => {},
      requestSpawnMenu: () => {},
    },
  }
}

describe('SelectTool ports', () => {
  it('does not reveal ports for an unselected nearby shape', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    tool.onPointerMove(pointerAt({ x: 140, y: 40 }), ctx)

    expect(store.getUiState().hoveredId).toBeNull()
  })

  it('does not start a port drag from an unselected hovered shape', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    store.setUiState({ hoveredId: 'shape-1' })
    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), ctx)

    expect(store.getSnapshot().order).toEqual(['shape-1'])
  })

  it('does not create a temporary arrow while holding a port click', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    store.setUiState({ selectedIds: new Set(['shape-1']) })
    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), ctx)

    expect(store.getSnapshot().order).toEqual(['shape-1'])
  })

  it('starts a port drag from a selected shape after dragging away from the port', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    store.setUiState({ selectedIds: new Set(['shape-1']) })
    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 180, y: 40 }), ctx)

    const created = store.getSnapshot().order
      .map((id) => store.getSnapshot().elements[id])
      .find((element) => element?.type === 'arrow')

    expect(created).toBeDefined()
  })

  it('treats a jittered port click as a spawn instead of leaving a short arrow', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    store.setUiState({ selectedIds: new Set(['shape-1']) })
    tool.onPointerDown(pointerAt({ x: 60, y: 100 }), ctx)
    tool.onPointerMove(pointerAt({ x: 68, y: 108 }), ctx)

    expect(store.getSnapshot().order).toEqual(['shape-1'])

    tool.onPointerUp(pointerAt({ x: 68, y: 108 }), ctx)

    const snapshot = store.getSnapshot()
    const arrows = Object.values(snapshot.elements).filter(isArrow)

    expect(snapshot.order).toHaveLength(3)
    expect(arrows).toHaveLength(1)
    expect(arrows[0]!.start?.elementId).toBe('shape-1')
    expect(arrows[0]!.end?.elementId).not.toBe('shape-1')
  })

  it('cancels a port drag released back on the source shape', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    store.setUiState({ selectedIds: new Set(['shape-1']) })
    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 110, y: 40 }), ctx)
    tool.onPointerUp(pointerAt({ x: 110, y: 40 }), ctx)

    expect(store.getSnapshot().order).toEqual(['shape-1'])
  })
})
