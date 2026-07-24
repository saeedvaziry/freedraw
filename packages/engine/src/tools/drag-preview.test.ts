import { describe, expect, it } from 'vitest'
import { createBinding } from '../connectors/binding.js'
import { createArrow, createFreedraw, createShape } from '../model/factory.js'
import type { ArrowElement } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import { buildTransientElements, moveElementPatch } from './drag-preview.js'

describe('moveElementPatch', () => {
  it('translates a shape by the delta', () => {
    const shape = createShape({ id: 'a', type: 'rect', x: 10, y: 20, width: 100, height: 60 })
    expect(moveElementPatch(shape, 30, -5, new Set(['a']))).toEqual({ x: 40, y: 15 })
  })

  it('translates freedraw points and recomputes bounds', () => {
    const freedraw = createFreedraw({ id: 'f', points: [{ x: 0, y: 0 }, { x: 20, y: 20 }] })
    const patch = moveElementPatch(freedraw, 5, 5, new Set(['f']))
    expect(patch.points).toEqual([{ x: 5, y: 5 }, { x: 25, y: 25 }])
    expect(patch).toMatchObject({ x: 5, y: 5, width: 20, height: 20 })
  })

  it('keeps bindings when both endpoints move with their shapes', () => {
    const arrow = createArrow({
      id: 'arrow',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      start: createBinding(createShape({ id: 's', x: -40, y: -40, width: 40, height: 40 }), { x: 0, y: 0 }, 0, { x: 100, y: 0 }),
      end: createBinding(createShape({ id: 'e', x: 100, y: -20, width: 40, height: 40 }), { x: 100, y: 0 }, 0, { x: 0, y: 0 }),
    })
    const patch = moveElementPatch(arrow, 10, 10, new Set(['s', 'e']))
    expect(patch.start).toBeUndefined()
    expect(patch.end).toBeUndefined()
    expect('start' in patch).toBe(false)
    expect('end' in patch).toBe(false)
    expect(patch.points).toEqual([{ x: 10, y: 10 }, { x: 110, y: 10 }])
  })

  it('detaches an arrow whose bound shapes are not moving', () => {
    const arrow = createArrow({
      id: 'arrow',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      start: createBinding(createShape({ id: 's', x: -40, y: -40, width: 40, height: 40 }), { x: 0, y: 0 }, 0, { x: 100, y: 0 }),
      end: createBinding(createShape({ id: 'e', x: 100, y: -20, width: 40, height: 40 }), { x: 100, y: 0 }, 0, { x: 0, y: 0 }),
    })
    const patch = moveElementPatch(arrow, 10, 10, new Set())
    expect(patch.start).toBeUndefined()
    expect(patch.end).toBeUndefined()
    expect('start' in patch).toBe(true)
    expect('end' in patch).toBe(true)
    expect(patch.routing).toBe('straight')
  })
})

describe('buildTransientElements', () => {
  it('includes moved shapes and re-routes their bound arrows in scene order', () => {
    const store = new SceneStore()
    const source = createShape({ id: 'source', type: 'rect', x: 0, y: 0, width: 120, height: 80 })
    const target = createShape({ id: 'target', type: 'rect', x: 400, y: 0, width: 120, height: 80 })
    const startPoint = { x: 120, y: 40 }
    const endPoint = { x: 400, y: 40 }
    const arrow = createArrow({
      id: 'arrow',
      points: [startPoint, endPoint],
      start: createBinding(source, startPoint, 0, endPoint),
      end: createBinding(target, endPoint, 0, startPoint),
      routing: 'orthogonal',
    })
    store.transact((api) => {
      api.addElement(source)
      api.addElement(target)
      api.addElement(arrow)
    })

    const movedSource = { ...source, y: 200 }
    const transient = buildTransientElements(store, new Map([['source', movedSource]]))

    const ids = transient.map((element) => element.id)
    expect(ids).toEqual(['source', 'arrow'])
    const previewArrow = transient.find((element) => element.id === 'arrow') as ArrowElement
    expect(previewArrow.route).toBeDefined()
    expect(previewArrow.route![0]!.y).toBeGreaterThan(120)
  })
})
