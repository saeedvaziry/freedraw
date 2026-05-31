import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import type { SceneSnapshot } from '../model/types.js'
import { defaultAppState } from '../model/schema.js'
import { contentBounds, fitCamera } from './fit.js'

function snapshotOf(...shapes: ReturnType<typeof createShape>[]): SceneSnapshot {
  const elements = Object.fromEntries(shapes.map((shape) => [shape.id, shape]))
  return { elements, order: shapes.map((shape) => shape.id), appState: defaultAppState() }
}

describe('contentBounds', () => {
  it('returns null for an empty board', () => {
    expect(contentBounds(snapshotOf())).toBeNull()
  })

  it('unions every element AABB', () => {
    const a = createShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 })
    const b = createShape({ id: 'b', x: 300, y: 200, width: 100, height: 100 })
    expect(contentBounds(snapshotOf(a, b))).toEqual({ x: 0, y: 0, width: 400, height: 300 })
  })
})

describe('fitCamera', () => {
  it('centers the content in the viewport', () => {
    const bounds = { x: 0, y: 0, width: 400, height: 300 }
    const camera = fitCamera(bounds, 800, 600, 0)
    const centerWorldX = camera.x + 800 / 2 / camera.zoom
    const centerWorldY = camera.y + 600 / 2 / camera.zoom
    expect(centerWorldX).toBeCloseTo(200)
    expect(centerWorldY).toBeCloseTo(150)
  })

  it('zooms so padded content fits the viewport', () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 1000 }
    const camera = fitCamera(bounds, 500, 500, 50)
    expect(camera.zoom).toBeCloseTo(400 / 1000)
  })
})
