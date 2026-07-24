import { describe, expect, it } from 'vitest'
import { createBinding } from '../connectors/binding.js'
import { arrowRoute } from '../connectors/resolve.js'
import { spawnConnectedShape, type SpawnDirection } from '../connectors/spawn.js'
import { Camera } from '../geometry/camera.js'
import { createArrow, createShape } from '../model/factory.js'
import type { ArrowElement, Element, ElementId, Point, ShapeType } from '../model/types.js'
import { SceneStore } from '../store/scene-store.js'
import type { EditRequest } from '../text/edit.js'
import type { PointerInfo, ToolContext } from './tool.js'
import { SelectTool } from './select-tool.js'

const camera = new Camera({ x: 0, y: 0, zoom: 1 })

interface FlowCall {
  sourceId: ElementId
  direction: SpawnDirection
  type?: ShapeType
}

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

function altPointerAt(point: Point): PointerInfo {
  return { ...pointerAt(point), altKey: true }
}

function altArrow(key: string): KeyboardEvent {
  return { key, altKey: true, preventDefault: () => {} } as unknown as KeyboardEvent
}

function tabKey(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent & { prevented: boolean } {
  const event = {
    key: 'Tab',
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    prevented: false,
    preventDefault() {
      event.prevented = true
    },
  }
  return Object.assign(event, overrides) as unknown as KeyboardEvent & { prevented: boolean }
}

function setup(): { store: SceneStore; ctx: ToolContext; flowCalls: FlowCall[] } {
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

  const flowCalls: FlowCall[] = []

  return {
    store,
    flowCalls,
    ctx: {
      store,
      camera,
      setPreview: () => {},
      setSpawnPreview: () => {},
      setMarquee: () => {},
      setGuides: () => {},
      setPortTarget: () => {},
      beginEdit: () => {},
      spawnChildAndEdit: (sourceId, direction, type) => {
        flowCalls.push({ sourceId, direction, type })
        const source = store.getSnapshot().elements[sourceId]
        if (source) spawnConnectedShape(store, source, direction, type)
      },
    },
  }
}

describe('SelectTool ports', () => {
  it('does not reveal ports for an unselected nearby shape', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    tool.onPointerMove(pointerAt({ x: 140, y: 40 }), ctx)

    expect(store.getHoveredId()).toBeNull()
  })

  it('does not start a port drag from an unselected hovered shape', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    store.setHoveredId('shape-1')
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

  it('moves a bound arrow by detaching it when its shapes are not selected', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    const source = store.getSnapshot().elements['shape-1']!
    const target = createShape({ id: 'shape-2', x: 300, y: 0, width: 120, height: 80 })
    const start = { x: source.x + source.width, y: source.y + source.height / 2 }
    const end = { x: target.x, y: target.y + target.height / 2 }
    const arrow = createArrow({
      id: 'arrow-1',
      points: [start, end],
      start: createBinding(source, start, 0, end),
      end: createBinding(target, end, 0, start),
      routing: 'orthogonal',
    })
    store.transact((api) => {
      api.addElement(target)
      api.addElement(arrow)
    })

    store.setUiState({ selectedIds: new Set(['arrow-1']) })
    tool.onPointerDown(pointerAt({ x: 180, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 210, y: 70 }), ctx)
    tool.onPointerUp(pointerAt({ x: 210, y: 70 }), ctx)

    const moved = store.getSnapshot().elements['arrow-1'] as ArrowElement
    expect(moved.start).toBeUndefined()
    expect(moved.end).toBeUndefined()
    expect(arrowRoute(moved)[0]).toEqual({ x: 151, y: 70 })
  })

  it('adjusts a bound arrow segment while preserving endpoint bindings', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    const source = store.getSnapshot().elements['shape-1']!
    const target = createShape({ id: 'shape-2', x: 300, y: 0, width: 120, height: 80 })
    const start = { x: source.x + source.width, y: source.y + source.height / 2 }
    const end = { x: target.x, y: target.y + target.height / 2 }
    const arrow = createArrow({
      id: 'arrow-1',
      points: [start, end],
      start: createBinding(source, start, 0, end),
      end: createBinding(target, end, 0, start),
      routing: 'orthogonal',
    })
    store.transact((api) => {
      api.addElement(target)
      api.addElement(arrow)
    })

    store.setUiState({ selectedIds: new Set(['arrow-1']) })
    tool.onPointerDown(pointerAt({ x: 210, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 210, y: -20 }), ctx)

    const adjusted = store.getSnapshot().elements['arrow-1'] as ArrowElement
    expect(adjusted.start?.elementId).toBe('shape-1')
    expect(adjusted.end?.elementId).toBe('shape-2')
    expect(adjusted.points.length).toBeGreaterThan(2)
    expect(adjusted.points.some((point) => point.y === -20)).toBe(true)
  })

  it('slides a bound endpoint when an adjacent segment is straightened', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    const source = store.getSnapshot().elements['shape-1']!
    const target = createShape({
      id: 'shape-2',
      x: 0,
      y: 300,
      width: 120,
      height: 80,
    })
    const start = { x: 60, y: source.y + source.height }
    const end = { x: 80, y: target.y }
    const arrow = {
      ...createArrow({
        id: 'arrow-1',
        points: [start, end],
        start: createBinding(source, start, 0, end),
        end: createBinding(target, end, 0, start),
        routing: 'orthogonal',
      }),
      points: [start, { x: 60, y: 180 }, { x: 80, y: 180 }, end],
    }
    store.transact((api) => {
      api.addElement(target)
      api.addElement(arrow)
    })

    store.setUiState({ selectedIds: new Set(['arrow-1']) })
    tool.onPointerDown(pointerAt({ x: 80, y: 240 }), ctx)
    tool.onPointerMove(pointerAt({ x: 60, y: 240 }), ctx)

    const adjusted = store.getSnapshot().elements['arrow-1'] as ArrowElement
    const route = arrowRoute(adjusted)
    expect(adjusted.end?.anchor.nx).toBeCloseTo(0.5)
    expect(route).toHaveLength(2)
    expect(route.every((point) => point.x === 60)).toBe(true)
  })
})

describe('SelectTool arrow labels', () => {
  it('starts editing when double-clicking an existing arrow label', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    const arrow: ArrowElement = {
      ...createArrow({
        id: 'arrow-1',
        points: [
          { x: 0, y: 160 },
          { x: 240, y: 160 },
        ],
      }),
      label: {
        text: 'relationship label',
        align: 'center',
        verticalAlign: 'middle',
      },
    }
    const editRequests: EditRequest[] = []
    ctx.beginEdit = (request) => {
      editRequests.push(request)
    }

    store.transact((api) => api.addElement(arrow))
    tool.onDoubleClick(pointerAt({ x: 120, y: 140 }), ctx)

    const editRequest = editRequests[0]
    expect(editRequest?.elementId).toBe('arrow-1')
    expect(editRequest?.target).toBe('label')
    expect(editRequest?.world.width).toBeGreaterThan(0)
  })
})

describe('SelectTool grouping', () => {
  it('selects the whole group when one member is clicked', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    const other = createShape({ id: 'shape-2', x: 300, y: 0, width: 120, height: 80 })
    store.transact((api) => api.addElement(other))
    store.groupElements(['shape-1', 'shape-2'])

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), ctx)

    expect([...store.getUiState().selectedIds].sort()).toEqual(['shape-1', 'shape-2'])
  })

  it('does not select a locked element', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.lockElements(['shape-1'])

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), ctx)

    expect(store.getUiState().selectedIds.size).toBe(0)
  })
})

describe('SelectTool locked bypass', () => {
  it('selects a single locked element on Alt+click', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    const other = createShape({ id: 'shape-2', x: 300, y: 0, width: 120, height: 80 })
    store.transact((api) => api.addElement(other))
    store.groupElements(['shape-1', 'shape-2'])
    store.lockElements(['shape-1', 'shape-2'])

    tool.onPointerDown(altPointerAt({ x: 60, y: 40 }), ctx)

    expect([...store.getUiState().selectedIds]).toEqual(['shape-1'])
  })

  it('does not move a locked element selected via Alt+click', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.lockElements(['shape-1'])

    tool.onPointerDown(altPointerAt({ x: 60, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 200, y: 200 }), ctx)
    tool.onPointerUp(pointerAt({ x: 200, y: 200 }), ctx)

    const shape = store.getSnapshot().elements['shape-1']
    expect(shape?.x).toBe(0)
    expect(shape?.y).toBe(0)
  })
})

describe('SelectTool flow spawn', () => {
  it('routes an Alt+Arrow press through spawnChildAndEdit', () => {
    const { store, ctx, flowCalls } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    const result = tool.onKeyDown(altArrow('ArrowRight'), ctx)

    expect(flowCalls).toHaveLength(1)
    expect(flowCalls[0]!.sourceId).toBe('shape-1')
    expect(flowCalls[0]!.direction).toBe('right')
    expect(result).toEqual({ scene: true, overlay: true })
    expect(store.getSnapshot().order).toHaveLength(3)
  })

  it('ignores Alt+Arrow unless exactly one shape is selected', () => {
    const { ctx, flowCalls } = setup()
    const tool = new SelectTool()

    tool.onKeyDown(altArrow('ArrowDown'), ctx)

    expect(flowCalls).toHaveLength(0)
  })

  it('routes a port click spawn through spawnChildAndEdit', () => {
    const { store, ctx, flowCalls } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt({ x: 60, y: 100 }), ctx)
    tool.onPointerUp(pointerAt({ x: 60, y: 100 }), ctx)

    expect(flowCalls).toHaveLength(1)
    expect(flowCalls[0]!.sourceId).toBe('shape-1')
    expect(flowCalls[0]!.direction).toBe('down')
  })

  it('starts the flow to the right on Tab with a single non-arrow selection', () => {
    const { store, ctx, flowCalls } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    const event = tabKey()
    const result = tool.onKeyDown(event, ctx)

    expect(flowCalls).toHaveLength(1)
    expect(flowCalls[0]!.sourceId).toBe('shape-1')
    expect(flowCalls[0]!.direction).toBe('right')
    expect(event.prevented).toBe(true)
    expect(result).toEqual({ scene: true, overlay: true })
    expect(store.getSnapshot().order).toHaveLength(3)
  })

  it('ignores Tab unless exactly one element is selected', () => {
    const { store, ctx, flowCalls } = setup()
    const tool = new SelectTool()
    const other = createShape({ id: 'shape-2', x: 300, y: 0, width: 120, height: 80 })
    store.transact((api) => api.addElement(other))
    store.setUiState({ selectedIds: new Set(['shape-1', 'shape-2']) })

    const event = tabKey()
    const result = tool.onKeyDown(event, ctx)

    expect(flowCalls).toHaveLength(0)
    expect(event.prevented).toBe(false)
    expect(result).toBeUndefined()
  })

  it('ignores Tab when the selection is an arrow', () => {
    const { store, ctx, flowCalls } = setup()
    const tool = new SelectTool()
    const arrow = createArrow({
      id: 'arrow-1',
      points: [
        { x: 0, y: 160 },
        { x: 240, y: 160 },
      ],
    })
    store.transact((api) => api.addElement(arrow))
    store.setUiState({ selectedIds: new Set(['arrow-1']) })

    const event = tabKey()
    const result = tool.onKeyDown(event, ctx)

    expect(flowCalls).toHaveLength(0)
    expect(event.prevented).toBe(false)
    expect(result).toBeUndefined()
  })

  it('ignores Tab combined with meta or ctrl modifiers', () => {
    const { store, ctx, flowCalls } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    const metaEvent = tabKey({ metaKey: true })
    const ctrlEvent = tabKey({ ctrlKey: true })
    tool.onKeyDown(metaEvent, ctx)
    tool.onKeyDown(ctrlEvent, ctx)

    expect(flowCalls).toHaveLength(0)
    expect(metaEvent.prevented).toBe(false)
    expect(ctrlEvent.prevented).toBe(false)
  })
})
