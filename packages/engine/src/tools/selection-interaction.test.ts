import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/camera.js'
import type { Rect } from '../geometry/rect.js'
import { createShape } from '../model/factory.js'
import type { Point } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import { SelectTool } from './select-tool.js'
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

interface Signals {
  marquee: (Rect | null)[]
  transforming: boolean[]
}

function setup(): { store: SceneStore; ctx: ToolContext; signals: Signals } {
  const store = new SceneStore()
  store.transact((api) =>
    api.addElement(createShape({ id: 'shape-1', type: 'rect', x: 0, y: 0, width: 120, height: 80 })),
  )
  const signals: Signals = { marquee: [], transforming: [] }
  return {
    store,
    signals,
    ctx: {
      store,
      camera,
      setPreview: () => {},
      setSpawnPreview: () => {},
      setMarquee: (rect) => {
        signals.marquee.push(rect)
      },
      setTransforming: (active) => {
        signals.transforming.push(active)
      },
      setGuides: () => {},
      setPortTarget: () => {},
      beginEdit: () => {},
      spawnChildAndEdit: () => {},
    },
  }
}

describe('SelectTool marquee signal', () => {
  it('publishes a marquee rect while dragging on empty canvas and clears it on release', () => {
    const { ctx, signals } = setup()
    const tool = new SelectTool()

    tool.onPointerDown(pointerAt({ x: 400, y: 400 }), ctx)
    tool.onPointerMove(pointerAt({ x: 500, y: 480 }), ctx)

    expect(signals.marquee.at(-1)).toEqual({ x: 400, y: 400, width: 100, height: 80 })

    tool.onPointerUp(pointerAt({ x: 500, y: 480 }), ctx)

    expect(signals.marquee.at(-1)).toBeNull()
  })

  it('does not publish a marquee when the pointer lands on an element', () => {
    const { ctx, signals } = setup()
    const tool = new SelectTool()

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 90, y: 60 }), ctx)

    expect(signals.marquee.filter(Boolean)).toHaveLength(0)
  })
})

describe('SelectTool transform signal', () => {
  it('marks a resize handle drag as transforming until release', () => {
    const { store, ctx, signals } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt({ x: 120, y: 80 }), ctx)

    expect(signals.transforming).toEqual([true])

    tool.onPointerUp(pointerAt({ x: 160, y: 120 }), ctx)

    expect(signals.transforming).toEqual([true, false])
  })

  it('marks a rotate handle drag as transforming', () => {
    const { store, ctx, signals } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt({ x: 60, y: -48 }), ctx)

    expect(signals.transforming).toEqual([true])
  })

  it('does not mark a plain element drag as transforming', () => {
    const { store, ctx, signals } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 90, y: 60 }), ctx)

    expect(signals.transforming.filter(Boolean)).toHaveLength(0)
  })

  it('clears both signals when the tool is deactivated', () => {
    const { ctx, signals } = setup()
    const tool = new SelectTool()

    tool.onDeactivate(ctx)

    expect(signals.marquee.at(-1)).toBeNull()
    expect(signals.transforming.at(-1)).toBe(false)
  })
})
