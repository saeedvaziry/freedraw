import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/Camera.js'
import { STICKY_COLORS } from '../model/factory.js'
import { SceneStore } from '../store/SceneStore.js'
import type { PointerInfo, ToolContext } from './Tool.js'
import { StickyTool } from './StickyTool.js'

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
    setSpawnPreview: () => {},
    setMarquee: () => {},
    setGuides: () => {},
    setPortTarget: () => {},
    beginEdit: () => {},
    requestSpawnMenu: () => {},
  }
  return { store, ctx }
}

describe('StickyTool', () => {
  it('creates a borderless sticky in the selected color, ignoring last-used fill', () => {
    const { ctx, store } = makeContext()
    store.updateLastUsedStyle({ fill: '#ff0000', stroke: '#00ff00' })
    const tool = new StickyTool('blue')

    tool.onPointerDown(pointer({ x: 100, y: 100 }))
    tool.onPointerUp(pointer({ x: 100, y: 100 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    expect(elements[0]!.style.fill).toBe(STICKY_COLORS.blue)
    expect(elements[0]!.style.strokeWidth).toBe(0)
    expect(elements[0]!.style.textAlign).toBe('center')
  })

  it('centers a click-placed sticky on half-grid guides', () => {
    const { ctx, store } = makeContext()
    const tool = new StickyTool()

    tool.onPointerDown(pointer({ x: 107, y: 93 }))
    tool.onPointerUp(pointer({ x: 107, y: 93 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements[0]).toMatchObject({ x: 25, y: 15, width: 160, height: 160 })
  })

  it('draws a custom-sized sticky when dragged', () => {
    const { ctx, store } = makeContext()
    const tool = new StickyTool()

    tool.onPointerDown(pointer({ x: 0, y: 0 }))
    tool.onPointerUp(pointer({ x: 200, y: 120 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements[0]).toMatchObject({ x: 0, y: 0, width: 200, height: 120 })
  })
})
