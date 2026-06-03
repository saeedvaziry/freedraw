import { describe, expect, it } from 'vitest'
import { createImage, createShape } from '../model/factory.js'
import type { SceneSnapshot } from '../model/types.js'
import { defaultAppState } from '../model/schema.js'
import { exportCanvasSize, exportImageAssetIds } from './exportScene.js'

function snapshotOf(...elements: ReturnType<typeof createShape>[]): SceneSnapshot {
  return {
    elements: Object.fromEntries(elements.map((element) => [element.id, element])),
    order: elements.map((element) => element.id),
    appState: defaultAppState(),
  }
}

describe('exportCanvasSize', () => {
  it('adds padding on both sides and applies the scale', () => {
    const size = exportCanvasSize({ x: 0, y: 0, width: 100, height: 50 }, 16, 2)
    expect(size.width).toBe((100 + 32) * 2)
    expect(size.height).toBe((50 + 32) * 2)
  })

  it('never returns a zero dimension', () => {
    const size = exportCanvasSize({ x: 0, y: 0, width: 0, height: 0 }, 0, 1)
    expect(size.width).toBeGreaterThanOrEqual(1)
    expect(size.height).toBeGreaterThanOrEqual(1)
  })
})

describe('exportImageAssetIds', () => {
  it('collects unique asset ids from image elements only', () => {
    const image = createImage({
      id: 'img-1',
      x: 0,
      y: 0,
      assetId: 'asset-a',
      naturalWidth: 100,
      naturalHeight: 100,
      viewportWidth: 800,
      viewportHeight: 600,
    })
    const shape = createShape({ type: 'rect', x: 0, y: 0, width: 10, height: 10 })
    const snapshot: SceneSnapshot = {
      elements: { [image.id]: image, [shape.id]: shape },
      order: [image.id, shape.id],
      appState: defaultAppState(),
    }
    expect(exportImageAssetIds(snapshot)).toEqual(['asset-a'])
  })

  it('returns an empty list for a board without images', () => {
    const snapshot = snapshotOf(createShape({ type: 'rect', x: 0, y: 0, width: 10, height: 10 }))
    expect(exportImageAssetIds(snapshot)).toEqual([])
  })
})
