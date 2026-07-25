import { describe, expect, it } from 'vitest'
import { createBinding } from '../connectors/binding.js'
import { arrowRoute } from '../connectors/resolve.js'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement, Element } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import { harness, pointerAt } from './drag-harness.js'
import { SelectTool } from './select-tool.js'

function isArrow(element: Element): element is ArrowElement {
  return element.type === 'arrow'
}

function committedArrow(store: SceneStore, id = 'arrow'): ArrowElement {
  return store.getSnapshot().elements[id] as ArrowElement
}

function previewedArrow(transient: (Element[] | null)[]): ArrowElement {
  return transient.at(-1)!.filter(isArrow)[0]!
}

function boundArrowScene(): SceneStore {
  const store = new SceneStore()
  const source = createShape({ id: 'source', type: 'rect', x: 0, y: 0, width: 120, height: 80 })
  const target = createShape({ id: 'target', type: 'rect', x: 300, y: 0, width: 120, height: 80 })
  const start = { x: 120, y: 40 }
  const end = { x: 300, y: 40 }
  store.transact((api) => {
    api.addElement(source)
    api.addElement(target)
    api.addElement(
      createArrow({
        id: 'arrow',
        points: [start, end],
        start: createBinding(source, start, 0, end),
        end: createBinding(target, end, 0, start),
        routing: 'orthogonal',
      }),
    )
  })
  return store
}

describe('drag layer — arrow endpoints', () => {
  it('previews an endpoint drag and commits once on release', () => {
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(createArrow({ id: 'arrow', points: [{ x: 200, y: 200 }, { x: 300, y: 200 }] })),
    )
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['arrow']) })

    tool.onPointerDown(pointerAt({ x: 300, y: 200 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 400, y: 200 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(arrowRoute(committedArrow(store)).at(-1)).toEqual({ x: 300, y: 200 })
    expect(arrowRoute(previewedArrow(h.transient)).at(-1)).toEqual({ x: 400, y: 200 })

    tool.onPointerUp(pointerAt({ x: 400, y: 200 }), h.ctx)

    expect(h.updates()).toBe(1)
    expect(h.history()).toBe(1)
    expect(h.transient.at(-1)).toBeNull()
    expect(arrowRoute(committedArrow(store)).at(-1)).toEqual({ x: 400, y: 200 })
  })

  it('commits the endpoint binding created by the drag', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(createShape({ id: 'shape', type: 'rect', x: 300, y: 160, width: 120, height: 80 }))
      api.addElement(createArrow({ id: 'arrow', points: [{ x: 100, y: 200 }, { x: 200, y: 200 }] }))
    })
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['arrow']) })

    tool.onPointerDown(pointerAt({ x: 200, y: 200 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 300, y: 200 }), h.ctx)

    expect(previewedArrow(h.transient).end?.elementId).toBe('shape')
    expect(committedArrow(store).end).toBeUndefined()

    tool.onPointerUp(pointerAt({ x: 300, y: 200 }), h.ctx)

    expect(h.updates()).toBe(1)
    expect(committedArrow(store).end?.elementId).toBe('shape')
  })
})

describe('drag layer — arrow segments', () => {
  it('previews a segment drag and commits once on release', () => {
    const store = boundArrowScene()
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['arrow']) })

    tool.onPointerDown(pointerAt({ x: 210, y: 40 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 210, y: -20 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(committedArrow(store).points).toHaveLength(2)
    expect(previewedArrow(h.transient).points.some((point) => point.y === -20)).toBe(true)

    tool.onPointerUp(pointerAt({ x: 210, y: -20 }), h.ctx)

    expect(h.updates()).toBe(1)
    expect(h.history()).toBe(1)
    expect(h.transient.at(-1)).toBeNull()
    const committed = committedArrow(store)
    expect(committed.points.some((point) => point.y === -20)).toBe(true)
    expect(committed.start?.elementId).toBe('source')
    expect(committed.end?.elementId).toBe('target')
  })
})

describe('drag layer — port drag', () => {
  it('previews the new arrow without adding it to the document', () => {
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(createShape({ id: 'source', type: 'rect', x: 0, y: 0, width: 120, height: 80 })),
    )
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['source']) })

    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 220, y: 40 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(store.getSnapshot().order).toEqual(['source'])
    expect(previewedArrow(h.transient).start?.elementId).toBe('source')

    tool.onPointerUp(pointerAt({ x: 220, y: 40 }), h.ctx)

    expect(h.updates()).toBe(1)
    expect(h.history()).toBe(1)
    expect(h.transient.at(-1)).toBeNull()
    const arrows = Object.values(store.getSnapshot().elements).filter(isArrow)
    expect(arrows).toHaveLength(1)
    expect(arrows[0]!.start?.elementId).toBe('source')
    expect(store.getUiState().selectedIds).toEqual(new Set([arrows[0]!.id]))
  })

  it('binds the committed arrow to the shape the drag ended on', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(createShape({ id: 'source', type: 'rect', x: 0, y: 0, width: 120, height: 80 }))
      api.addElement(createShape({ id: 'target', type: 'rect', x: 300, y: 0, width: 120, height: 80 }))
    })
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['source']) })

    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 300, y: 40 }), h.ctx)
    tool.onPointerUp(pointerAt({ x: 300, y: 40 }), h.ctx)

    const arrows = Object.values(store.getSnapshot().elements).filter(isArrow)
    expect(h.updates()).toBe(1)
    expect(arrows).toHaveLength(1)
    expect(arrows[0]!.end?.elementId).toBe('target')
  })

  it('writes nothing when the port drag is released back on the source shape', () => {
    const store = new SceneStore()
    store.transact((api) =>
      api.addElement(createShape({ id: 'source', type: 'rect', x: 0, y: 0, width: 120, height: 80 })),
    )
    const h = harness(store)
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['source']) })

    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), h.ctx)
    tool.onPointerMove(pointerAt({ x: 220, y: 40 }), h.ctx)
    tool.onPointerUp(pointerAt({ x: 60, y: 40 }), h.ctx)

    expect(h.updates()).toBe(0)
    expect(h.history()).toBe(0)
    expect(store.getSnapshot().order).toEqual(['source'])
    expect(h.transient.at(-1)).toBeNull()
  })
})
