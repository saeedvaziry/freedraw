import { describe, expect, it } from 'vitest'
import { Camera } from '../geometry/Camera.js'
import { TEXT_DEFAULT_HEIGHT, TEXT_DEFAULT_WIDTH } from '../model/factory.js'
import { SceneStore } from '../store/SceneStore.js'
import type { PointerInfo, ToolContext } from './Tool.js'
import { TextTool } from './TextTool.js'

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

describe('TextTool', () => {
  it('centers new text on half-grid guides', () => {
    const { ctx, store } = makeContext()

    new TextTool().onPointerDown(pointer({ x: 107, y: 93 }), ctx)

    const elements = Object.values(store.getSnapshot().elements)
    expect(elements[0]).toMatchObject({
      x: 25,
      y: 83,
      width: TEXT_DEFAULT_WIDTH,
      height: TEXT_DEFAULT_HEIGHT,
    })
  })
})
