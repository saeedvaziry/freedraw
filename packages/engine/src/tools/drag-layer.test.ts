import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createBinding } from '../connectors/binding.js'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import { harness, pointerAt } from './drag-harness.js'
import { SelectTool } from './select-tool.js'

function shapeStore(): SceneStore {
  const store = new SceneStore()
  store.transact((api) =>
    api.addElement(createShape({ id: 'a', type: 'rect', x: 0, y: 0, width: 120, height: 80 })),
  )
  return store
}

describe('drag layer — move', () => {
  it('writes nothing to the doc during a move and commits once on release', () => {
    const store = shapeStore()
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['a']) })

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 110, y: 40 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(store.getSnapshot().elements['a']!.x).toBe(0)
    expect(h.transient.at(-1)?.some((element) => element.id === 'a')).toBe(true)

    tool.onPointerUp(pointerAt({ x: 110, y: 40 }), h.ctx)

    expect(h.updates()).toBe(1)
    expect(store.getSnapshot().elements['a']!.x).toBe(50)
    expect(h.transient.at(-1)).toBeNull()
    expect(h.history()).toBe(1)
  })

  it('does not commit a click that never crossed the drag threshold', () => {
    const store = shapeStore()
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['a']) })

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), h.ctx)
    tool.onPointerUp(pointerAt({ x: 60, y: 40 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(store.getSnapshot().elements['a']!.x).toBe(0)
  })

  it('rebases the committed move onto a concurrent remote update', () => {
    const store = shapeStore()
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['a']) })

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 110, y: 40 }), h.ctx)

    const remote = new SceneStore()
    Y.applyUpdate(remote.doc, Y.encodeStateAsUpdate(store.doc))
    remote.transact((api) => api.updateElement('a', { y: 100 }))
    Y.applyUpdate(store.doc, Y.encodeStateAsUpdate(remote.doc), 'remote-peer')
    expect(store.getSnapshot().elements['a']!.y).toBe(100)

    tool.onPointerUp(pointerAt({ x: 110, y: 40 }), h.ctx)

    const committed = store.getSnapshot().elements['a']!
    expect(committed.x).toBe(50)
    expect(committed.y).toBe(100)
  })

  it('follows a bound arrow through the transient preview when its shape moves', () => {
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
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['source']) })

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 60, y: 140 }), h.ctx)

    const preview = h.transient.at(-1)!
    expect(preview.find((element) => element.id === 'source')!.y).toBe(100)
    const previewArrow = preview.find((element) => element.id === 'arrow') as ArrowElement | undefined
    expect(previewArrow).toBeDefined()
    expect(previewArrow!.route![0]!.y).toBeGreaterThan(120)
    expect(h.updates()).toBe(0)
  })
})

describe('drag layer — resize and rotate', () => {
  it('writes nothing during a resize and commits once on release', () => {
    const store = shapeStore()
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['a']) })

    tool.onPointerDown(pointerAt({ x: 120, y: 80 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 200, y: 160 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(store.getSnapshot().elements['a']!.width).toBe(120)

    tool.onPointerUp(pointerAt({ x: 200, y: 160 }), h.ctx)

    expect(h.updates()).toBe(1)
    expect(store.getSnapshot().elements['a']!.width).toBeGreaterThan(120)
    expect(h.history()).toBe(1)
  })

  it('writes nothing during a rotate and commits once on release', () => {
    const store = shapeStore()
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['a']) })

    tool.onPointerDown(pointerAt({ x: 60, y: -48 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 100, y: -48 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(store.getSnapshot().elements['a']!.rotation).toBe(0)

    tool.onPointerUp(pointerAt({ x: 100, y: -48 }), h.ctx)

    expect(h.updates()).toBe(1)
    expect(store.getSnapshot().elements['a']!.rotation).not.toBe(0)
    expect(h.history()).toBe(1)
  })
})
