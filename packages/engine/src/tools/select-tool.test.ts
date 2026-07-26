import { describe, expect, it } from 'vitest'
import { createBinding } from '../connectors/binding.js'
import { arrowRoute } from '../connectors/resolve.js'
import { spawnConnectedShape, type SpawnDirection } from '../connectors/spawn.js'
import { ALIGN_SNAP_DISTANCE } from '../geometry/align-snap.js'
import { Camera } from '../geometry/camera.js'
import { snapPointToGrid } from '../geometry/grid.js'
import {
  resizeHandlesScreen,
  rotateHandleScreen,
  type ResizeHandleId,
  type SelectionFrame,
} from '../geometry/handles.js'
import type { Rect } from '../geometry/rect.js'
import { rotatedBounds, rotatePoint, rotateVector } from '../geometry/rotate.js'
import { selectionFrameFor } from '../geometry/selection-frame.js'
import type { SnapGuide } from '../geometry/snap.js'
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

function frameCorners(frame: SelectionFrame): Point[] {
  const { bounds, center, rotation } = frame
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ].map((corner) => rotatePoint(corner, center, rotation))
}

function closeTo(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
}

function tiltedPairStore(rotation: number): { store: SceneStore; ctx: ToolContext } {
  const { store, ctx } = setup()
  const pivot = { x: 150, y: 50 }
  store.transact((api) => {
    api.removeElements(['shape-1'])
    for (const [id, origin] of [
      ['a', { x: 0, y: 0 }],
      ['b', { x: 200, y: 0 }],
    ] as const) {
      const center = rotatePoint({ x: origin.x + 50, y: origin.y + 50 }, pivot, rotation)
      api.addElement(
        createShape({
          id,
          x: center.x - 50,
          y: center.y - 50,
          width: 100,
          height: 100,
          rotation,
        }),
      )
    }
  })
  store.setUiState({ selectedIds: new Set(['a', 'b']) })
  return { store, ctx }
}

function selectedShapes(store: SceneStore): Element[] {
  return [...store.getUiState().selectedIds]
    .map((id) => store.getSnapshot().elements[id])
    .filter(Boolean) as Element[]
}

function addFrameLocalShape(store: SceneStore, id: ElementId, local: Rect, frame: SelectionFrame): void {
  const center = rotatePoint(
    { x: local.x + local.width / 2, y: local.y + local.height / 2 },
    frame.center,
    frame.rotation,
  )
  store.transact((api) =>
    api.addElement(
      createShape({
        id,
        x: center.x - local.width / 2,
        y: center.y - local.height / 2,
        width: local.width,
        height: local.height,
        rotation: frame.rotation,
      }),
    ),
  )
}

function addRotatedShape(
  store: SceneStore,
  id: ElementId,
  frame: SelectionFrame,
  localCenter: Point,
  size: { width: number; height: number },
  rotation: number,
): void {
  const center = rotatePoint(localCenter, frame.center, frame.rotation)
  store.transact((api) =>
    api.addElement(
      createShape({ id, x: center.x - size.width / 2, y: center.y - size.height / 2, ...size, rotation }),
    ),
  )
}

function frameLocalBounds(element: Element, rotation: number, frame: SelectionFrame): Rect {
  const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
  const points = [
    { x: element.x, y: element.y },
    { x: element.x + element.width, y: element.y },
    { x: element.x + element.width, y: element.y + element.height },
    { x: element.x, y: element.y + element.height },
  ].map((corner) => rotatePoint(rotatePoint(corner, center, rotation), frame.center, -frame.rotation))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function frameLocalRect(element: Element, frame: SelectionFrame): Rect {
  const center = rotatePoint(
    { x: element.x + element.width / 2, y: element.y + element.height / 2 },
    frame.center,
    -frame.rotation,
  )
  return {
    x: center.x - element.width / 2,
    y: center.y - element.height / 2,
    width: element.width,
    height: element.height,
  }
}

function captureGuides(ctx: ToolContext): SnapGuide[][] {
  const captured: SnapGuide[][] = []
  ctx.setGuides = (guides) => {
    captured.push(guides)
  }
  return captured
}

function alignGuideOf(guides: SnapGuide[]): Extract<SnapGuide, { kind: 'align' }> | undefined {
  return guides.find((guide): guide is Extract<SnapGuide, { kind: 'align' }> => guide.kind === 'align')
}

describe('SelectTool multi-select resize on a tilted frame', () => {
  it('stretches the group along the frame axis and pins the opposite edge', () => {
    const rotation = 0.6
    const { store, ctx } = tiltedPairStore(rotation)
    const tool = new SelectTool()
    const frame = selectionFrameFor(selectedShapes(store))!

    expect(frame.rotation).toBeCloseTo(rotation, 6)
    expect(frame.bounds.width).toBeCloseTo(300, 6)
    expect(frame.bounds.height).toBeCloseTo(100, 6)

    const before = frameCorners(frame)
    tool.onPointerDown(pointerAt(rotatePoint({ x: 300, y: 50 }, frame.center, rotation)), ctx)
    tool.onPointerMove(pointerAt(rotatePoint({ x: 600, y: 50 }, frame.center, rotation)), ctx)
    tool.onPointerUp(pointerAt(rotatePoint({ x: 600, y: 50 }, frame.center, rotation)), ctx)

    const resized = selectionFrameFor(selectedShapes(store))!
    expect(resized.rotation).toBeCloseTo(rotation, 6)
    expect(resized.bounds.height).toBeCloseTo(100, 6)
    expect(resized.bounds.width).toBeGreaterThan(400)

    const after = frameCorners(resized)
    closeTo(after[0]!, before[0]!)
    closeTo(after[3]!, before[3]!)
  })

  it('keeps every shape on the frame axis instead of dragging it along the world axis', () => {
    const rotation = -1.1
    const { store, ctx } = tiltedPairStore(rotation)
    const tool = new SelectTool()
    const frame = selectionFrameFor(selectedShapes(store))!

    tool.onPointerDown(pointerAt(rotatePoint({ x: 300, y: 50 }, frame.center, rotation)), ctx)
    tool.onPointerMove(pointerAt(rotatePoint({ x: 480, y: 50 }, frame.center, rotation)), ctx)
    tool.onPointerUp(pointerAt(rotatePoint({ x: 480, y: 50 }, frame.center, rotation)), ctx)

    const resized = selectionFrameFor(selectedShapes(store))!
    for (const shape of selectedShapes(store)) {
      expect(shape.rotation).toBeCloseTo(rotation, 6)
      expect(shape.height).toBeCloseTo(100, 6)
      expect(shape.width).toBeGreaterThan(100)
      const local = rotatePoint(
        { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 },
        resized.center,
        -resized.rotation,
      )
      expect(local.y).toBeCloseTo(resized.bounds.y + resized.bounds.height / 2, 6)
    }
  })
})

describe('SelectTool align snap on a tilted frame', () => {
  it('snaps a dragged group flush to a same-tilt neighbour and draws the constraint it applied', () => {
    const rotation = 0.6
    const { store, ctx } = tiltedPairStore(rotation)
    const tool = new SelectTool()
    const frame = selectionFrameFor(selectedShapes(store))!
    const down = rotatePoint({ x: 50, y: 50 }, frame.center, rotation)
    const up = { x: down.x + 20, y: down.y + 30 }
    const start = snapPointToGrid(down)
    const end = snapPointToGrid(up)
    const drag = rotateVector({ x: end.x - start.x, y: end.y - start.y }, -rotation)
    addFrameLocalShape(store, 'c', { x: drag.x + 2, y: 300, width: 100, height: 100 }, frame)
    const guides = captureGuides(ctx)

    tool.onPointerDown(pointerAt(down), ctx)
    tool.onPointerMove(pointerAt(up), ctx)
    const applied = guides[guides.length - 1] ?? []
    tool.onPointerUp(pointerAt(up), ctx)

    const neighbour = frameLocalRect(store.getSnapshot().elements['c']!, frame)
    const moved = frameLocalRect(store.getSnapshot().elements['a']!, frame)
    expect(moved.x).toBeCloseTo(neighbour.x, 6)
    expect(moved.y).toBeCloseTo(drag.y, 6)

    const guide = alignGuideOf(applied)
    expect(guide).toBeDefined()
    expect(guide!.from.x).not.toBeCloseTo(guide!.to.x, 6)
    for (const point of [guide!.from, guide!.to]) {
      expect(rotatePoint(point, frame.center, -rotation).x).toBeCloseTo(neighbour.x, 6)
    }
  })

  it('snaps a tilted resize flush to a same-tilt neighbour', () => {
    const rotation = 0.6
    const { store, ctx } = tiltedPairStore(rotation)
    const tool = new SelectTool()
    const frame = selectionFrameFor(selectedShapes(store))!
    const handle = rotatePoint({ x: 300, y: 50 }, frame.center, rotation)
    const target = rotatePoint({ x: 420, y: 50 }, frame.center, rotation)
    const localTarget = rotatePoint(snapPointToGrid(target), frame.center, -rotation)
    addFrameLocalShape(store, 'c', { x: localTarget.x + 2, y: 0, width: 100, height: 100 }, frame)
    const guides = captureGuides(ctx)

    tool.onPointerDown(pointerAt(handle), ctx)
    tool.onPointerMove(pointerAt(target), ctx)
    const applied = guides[guides.length - 1] ?? []
    tool.onPointerUp(pointerAt(target), ctx)

    const neighbour = frameLocalRect(store.getSnapshot().elements['c']!, frame)
    const resized = frameLocalRect(store.getSnapshot().elements['b']!, frame)
    expect(resized.x + resized.width).toBeCloseTo(neighbour.x, 6)

    const guide = alignGuideOf(applied)
    expect(guide).toBeDefined()
    for (const point of [guide!.from, guide!.to]) {
      expect(rotatePoint(point, frame.center, -rotation).x).toBeCloseTo(neighbour.x, 6)
    }
  })

  it('snaps a dragged group to the real edge of a neighbour tilted at a third angle', () => {
    const rotation = 0.6
    const { store, ctx } = tiltedPairStore(rotation)
    const tool = new SelectTool()
    const frame = selectionFrameFor(selectedShapes(store))!
    const down = rotatePoint({ x: 50, y: 50 }, frame.center, rotation)
    const up = { x: down.x + 20, y: down.y + 30 }
    const start = snapPointToGrid(down)
    const end = snapPointToGrid(up)
    const drag = rotateVector({ x: end.x - start.x, y: end.y - start.y }, -rotation)
    addRotatedShape(store, 'c', frame, { x: drag.x + 22, y: 400 }, { width: 200, height: 40 }, rotation + Math.PI / 2)
    const guides = captureGuides(ctx)

    tool.onPointerDown(pointerAt(down), ctx)
    tool.onPointerMove(pointerAt(up), ctx)
    const applied = guides[guides.length - 1] ?? []
    tool.onPointerUp(pointerAt(up), ctx)

    const neighbour = store.getSnapshot().elements['c']!
    const outline = frameLocalBounds(neighbour, neighbour.rotation, frame)
    const footprint = frameLocalBounds(neighbour, 0, frame)
    const moved = frameLocalRect(store.getSnapshot().elements['a']!, frame)
    expect(moved.x).toBeCloseTo(outline.x, 6)
    expect(moved.y).toBeCloseTo(drag.y, 6)
    expect(Math.abs(footprint.x - moved.x)).toBeGreaterThan(ALIGN_SNAP_DISTANCE)

    const guide = alignGuideOf(applied)
    expect(guide).toBeDefined()
    for (const point of [guide!.from, guide!.to]) {
      expect(rotatePoint(point, frame.center, -rotation).x).toBeCloseTo(outline.x, 6)
    }
  })

  it('snaps an unrotated group to the real edge of a rotated neighbour', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    const rotation = Math.PI / 6
    const halfWidth = (120 * Math.cos(rotation) + 80 * Math.sin(rotation)) / 2
    store.transact((api) =>
      api.addElement(
        createShape({ id: 'shape-2', x: 3 + halfWidth - 60, y: 300, width: 120, height: 80, rotation }),
      ),
    )
    const guides = captureGuides(ctx)

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 65, y: 45 }), ctx)
    const applied = guides[guides.length - 1] ?? []
    tool.onPointerUp(pointerAt({ x: 65, y: 45 }), ctx)

    const neighbour = store.getSnapshot().elements['shape-2']!
    const outline = rotatedBounds(neighbour)
    const moved = store.getSnapshot().elements['shape-1']!
    expect(moved.x).toBeCloseTo(outline.x, 6)
    expect(moved.y).toBe(5)
    expect(Math.abs(neighbour.x - moved.x)).toBeGreaterThan(ALIGN_SNAP_DISTANCE)

    const guide = alignGuideOf(applied)
    expect(guide).toBeDefined()
    expect(guide!.from.x).toBeCloseTo(outline.x, 6)
    expect(guide!.to.x).toBeCloseTo(outline.x, 6)
  })

  it('keeps an unrotated group snapping on the world axes', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.transact((api) => api.addElement(createShape({ id: 'shape-2', x: 3, y: 300, width: 120, height: 80 })))
    const guides = captureGuides(ctx)

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 65, y: 60 }), ctx)
    const applied = guides[guides.length - 1] ?? []
    tool.onPointerUp(pointerAt({ x: 65, y: 60 }), ctx)

    const moved = store.getSnapshot().elements['shape-1']!
    expect(moved.x).toBe(3)
    expect(moved.y).toBe(20)

    const guide = alignGuideOf(applied)
    expect(guide).toBeDefined()
    expect(guide!.from.x).toBe(3)
    expect(guide!.to.x).toBe(3)
  })
})

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

    expect(store.getSnapshot().order).toEqual(['shape-1'])

    tool.onPointerUp(pointerAt({ x: 180, y: 40 }), ctx)

    const created = store.getSnapshot().order
      .map((id) => store.getSnapshot().elements[id])
      .find((element) => element?.type === 'arrow')

    expect(created).toBeDefined()
    expect(store.getUiState().selectedIds).toEqual(new Set([created!.id]))
  })

  it('leaves no dangling selected id when a port-drag arrow is undone', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    store.stopCapturing()
    store.setUiState({ selectedIds: new Set(['shape-1']) })
    tool.onPointerDown(pointerAt({ x: 140, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 180, y: 40 }), ctx)
    tool.onPointerUp(pointerAt({ x: 180, y: 40 }), ctx)

    const created = Object.values(store.getSnapshot().elements).find(isArrow)
    expect(created).toBeDefined()
    expect(store.getUiState().selectedIds).toEqual(new Set([created!.id]))

    store.undo()

    const { elements } = store.getSnapshot()
    expect(elements[created!.id]).toBeUndefined()
    expect([...store.getUiState().selectedIds].filter((id) => !elements[id])).toEqual([])
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
    tool.onPointerUp(pointerAt({ x: 210, y: -20 }), ctx)

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
    tool.onPointerUp(pointerAt({ x: 60, y: 240 }), ctx)

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

describe('SelectTool cursor', () => {
  function handlePoint(store: SceneStore, id: ResizeHandleId): Point {
    const frame = selectionFrameFor(selectedShapes(store))!
    return resizeHandlesScreen(frame, camera).find((handle) => handle.id === id)!.position
  }

  function rotateHandlePoint(store: SceneStore): Point {
    return rotateHandleScreen(selectionFrameFor(selectedShapes(store))!, camera).position
  }

  it('falls back to the default cursor while the pointer is off the canvas', () => {
    const { ctx } = setup()

    expect(new SelectTool().cursorFor(null, ctx)).toBe('default')
  })

  it('reads the rotate handle as a rotate affordance', () => {
    const { store, ctx } = setup()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    expect(new SelectTool().cursorFor(pointerAt(rotateHandlePoint(store)), ctx)).toBe('grab')
  })

  it('reads the resize handles of an upright frame by direction', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    expect(tool.cursorFor(pointerAt(handlePoint(store, 'n')), ctx)).toBe('ns-resize')
    expect(tool.cursorFor(pointerAt(handlePoint(store, 'e')), ctx)).toBe('ew-resize')
    expect(tool.cursorFor(pointerAt(handlePoint(store, 'se')), ctx)).toBe('nwse-resize')
    expect(tool.cursorFor(pointerAt(handlePoint(store, 'ne')), ctx)).toBe('nesw-resize')
  })

  it('rotates the handle cursor with a quarter-turned frame', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.transact((api) => api.updateElement('shape-1', { rotation: Math.PI / 2 }))
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    expect(tool.cursorFor(pointerAt(handlePoint(store, 'n')), ctx)).toBe('ew-resize')
    expect(tool.cursorFor(pointerAt(handlePoint(store, 'e')), ctx)).toBe('ns-resize')
    expect(tool.cursorFor(pointerAt(handlePoint(store, 'ne')), ctx)).toBe('nwse-resize')
  })

  it('moves over a selected element and stays default over an unselected one', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()

    expect(tool.cursorFor(pointerAt({ x: 60, y: 40 }), ctx)).toBe('default')

    store.setUiState({ selectedIds: new Set(['shape-1']) })

    expect(tool.cursorFor(pointerAt({ x: 60, y: 40 }), ctx)).toBe('move')
  })

  it('stays default over empty canvas', () => {
    const { store, ctx } = setup()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    expect(new SelectTool().cursorFor(pointerAt({ x: 400, y: 400 }), ctx)).toBe('default')
  })

  it('hints the unlock affordance only while Alt is held over a locked element', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.lockElements(['shape-1'])

    expect(tool.cursorFor(pointerAt({ x: 60, y: 40 }), ctx)).toBe('default')
    expect(tool.cursorFor(altPointerAt({ x: 60, y: 40 }), ctx)).toBe('pointer')
  })

  it('keeps the handle cursor while a resize drag runs past the handle', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt(handlePoint(store, 'e')), ctx)
    tool.onPointerMove(pointerAt({ x: 400, y: 400 }), ctx)

    expect(tool.cursorFor(pointerAt({ x: 400, y: 400 }), ctx)).toBe('ew-resize')
  })

  it('keeps the rotate cursor for the whole rotate drag', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt(rotateHandlePoint(store)), ctx)
    tool.onPointerMove(pointerAt({ x: 400, y: 400 }), ctx)

    expect(tool.cursorFor(pointerAt({ x: 400, y: 400 }), ctx)).toBe('grab')
  })

  it('keeps the move cursor while dragging a selection past its own bounds', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt({ x: 60, y: 40 }), ctx)
    tool.onPointerMove(pointerAt({ x: 400, y: 400 }), ctx)

    expect(tool.cursorFor(pointerAt({ x: 400, y: 400 }), ctx)).toBe('move')
  })

  it('stays default while a marquee is running over a selected element', () => {
    const { store, ctx } = setup()
    const tool = new SelectTool()
    store.setUiState({ selectedIds: new Set(['shape-1']) })

    tool.onPointerDown(pointerAt({ x: 400, y: 400 }), ctx)
    tool.onPointerMove(pointerAt({ x: 60, y: 40 }), ctx)

    expect(tool.cursorFor(pointerAt({ x: 60, y: 40 }), ctx)).toBe('default')
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
