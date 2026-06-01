import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/Camera.js'
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
    setMarquee: () => {},
    setGuides: () => {},
    setPortTarget: () => {},
    beginEdit: () => {},
  }
  return { store, ctx }
}

describe('StickyTool', () => {
  it('creates sticky notes from the current default style', () => {
    const { ctx, store } = makeContext()
    store.updateLastUsedStyle({
      fill: '#ff0000',
      stroke: '#00ff00',
      roundness: 24,
      textAlign: 'right',
    })

    new StickyTool().onPointerDown(pointer({ x: 100, y: 100 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements).toHaveLength(1)
    expect(elements[0]!.style.fill).toBe('#ff0000')
    expect(elements[0]!.style.stroke).toBe('#00ff00')
    expect(elements[0]!.style.roundness).toBe(24)
    expect(elements[0]!.style.textAlign).toBe('right')
  })

  it('centers new sticky notes on half-grid guides', () => {
    const { ctx, store } = makeContext()

    new StickyTool().onPointerDown(pointer({ x: 107, y: 93 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements[0]).toMatchObject({ x: 25, y: 35, width: 160, height: 120 })
  })
})
