import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardActionContext } from '@/components/board/board-actions.js'
import { subscribeCanvasAnnouncements } from './use-canvas-a11y.js'
import { useBoardActions } from './use-board-actions.js'

interface FakeUiState {
  activeTool: string
  activeShapeType: string
  selectedIds: Set<string>
  toolLock: boolean
  clipboardElementCount: number
}

interface FakeElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  points?: { x: number; y: number }[]
  locked?: boolean
  groupId?: string
  label?: { text: string }
}

function element(id: string, over: Partial<FakeElement> = {}): FakeElement {
  return { id, type: 'rect', x: 0, y: 0, width: 100, height: 50, ...over }
}

function fakeStore() {
  const ui: FakeUiState = {
    activeTool: 'select',
    activeShapeType: 'rect',
    selectedIds: new Set<string>(),
    toolLock: false,
    clipboardElementCount: 0,
  }
  const snapshot = {
    elements: {} as Record<string, FakeElement>,
    order: [] as string[],
    appState: { snapGuidesEnabled: true },
  }
  const selectionSubscribers = new Set<() => void>()

  return {
    ui,
    snapshot,
    seed(...elements: FakeElement[]) {
      for (const entry of elements) {
        snapshot.elements[entry.id] = entry
        snapshot.order.push(entry.id)
      }
    },
    store: {
      canUndo: true,
      canRedo: true,
      undo: vi.fn(),
      redo: vi.fn(),
      deleteElements: vi.fn(),
      getUiState: () => ui,
      getSnapshot: () => snapshot,
      stopCapturing: vi.fn(),
      setUiState: vi.fn((patch: Partial<FakeUiState>) => {
        Object.assign(ui, patch)
        if ('selectedIds' in patch) selectionSubscribers.forEach((notify) => notify())
      }),
      subscribeSelection: (notify: () => void) => {
        selectionSubscribers.add(notify)
        return () => selectionSubscribers.delete(notify)
      },
      transact: vi.fn(
        (run: (api: { updateElement: (id: string, patch: Partial<FakeElement>) => void }) => void) => {
          run({
            updateElement: (id, patch) => {
              const target = snapshot.elements[id]
              if (target) Object.assign(target, patch)
            },
          })
        },
      ),
    },
  }
}

function fakeController() {
  return {
    isReadOnly: false,
    activeEdit: null as unknown,
    cursorWorldPoint: { x: 0, y: 0 },
    viewportSize: { width: 800, height: 600 },
    beginLabelEditFromText: vi.fn(),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    focusViewport: vi.fn(),
    zoomToFit: vi.fn(),
    zoomToActualSize: vi.fn(),
  }
}

const openImagePicker = vi.fn()

function setup(readOnly = false) {
  const scene = fakeStore()
  const controller = fakeController()
  const context = (over: { readOnly: boolean }): BoardActionContext =>
    ({
      store: scene.store,
      controller,
      boardExport: {},
      theme: 'light',
      readOnly: over.readOnly,
      openImagePicker,
    }) as unknown as BoardActionContext

  const view = renderHook((props: { readOnly: boolean }) => useBoardActions(context(props)), {
    initialProps: { readOnly },
  })

  return { ...view, ...scene, controller }
}

function press(init: KeyboardEventInit, target: EventTarget = window): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

let announcements: string[] = []
let stopAnnouncements: (() => void) | null = null

beforeEach(() => {
  vi.clearAllMocks()
  announcements = []
  stopAnnouncements = subscribeCanvasAnnouncements(({ message }) => {
    announcements.push(message)
  })
})

afterEach(() => {
  stopAnnouncements?.()
  stopAnnouncements = null
  document.body.innerHTML = ''
})

describe('useBoardActions shortcuts', () => {
  it('runs the matching action and swallows the key', () => {
    const { store } = setup()

    expect(press({ key: 'z', metaKey: true })).toBe(true)
    expect(store.undo).toHaveBeenCalledTimes(1)
  })

  it('separates redo from undo by the shift key', () => {
    const { store } = setup()

    press({ key: 'z', metaKey: true, shiftKey: true })

    expect(store.redo).toHaveBeenCalledTimes(1)
    expect(store.undo).not.toHaveBeenCalled()
  })

  it('swallows a browser shortcut it owns even when the action is unavailable', () => {
    const { store } = setup(true)

    expect(press({ key: 'z', metaKey: true })).toBe(true)
    expect(store.undo).not.toHaveBeenCalled()
  })

  it('leaves a modifier combination it does not own to the browser', () => {
    const { store } = setup()

    expect(press({ key: 'y', metaKey: true })).toBe(false)
    expect(store.setUiState).not.toHaveBeenCalled()
  })
})

describe('useBoardActions tool hotkeys', () => {
  it('picks a plain tool from its letter', () => {
    const { store } = setup()

    expect(press({ key: 'h' })).toBe(true)
    expect(store.setUiState).toHaveBeenCalledWith({ activeTool: 'hand' })
  })

  it('picks a shape tool together with its shape type', () => {
    const { store } = setup()

    press({ key: 'D' })

    expect(store.setUiState).toHaveBeenCalledWith({
      activeTool: 'shape',
      activeShapeType: 'diamond',
    })
  })

  it('opens the image picker instead of switching to an image tool', () => {
    const { store } = setup()

    press({ key: 'i' })

    expect(openImagePicker).toHaveBeenCalledTimes(1)
    expect(store.setUiState).not.toHaveBeenCalled()
  })

  it('ignores an unmapped letter', () => {
    const { store } = setup()

    expect(press({ key: 'j' })).toBe(false)
    expect(store.setUiState).not.toHaveBeenCalled()
  })

  it('ignores every tool hotkey on a read-only board', () => {
    const { store } = setup(true)

    expect(press({ key: 'h' })).toBe(false)
    expect(store.setUiState).not.toHaveBeenCalled()
  })
})

describe('useBoardActions label editing', () => {
  it('types straight into the single selected element instead of switching tools', () => {
    const { ui, controller, store } = setup()
    ui.selectedIds = new Set(['element-1'])

    expect(press({ key: 'x' })).toBe(true)
    expect(controller.beginLabelEditFromText).toHaveBeenCalledWith('element-1', 'x')
    expect(store.setUiState).not.toHaveBeenCalled()
  })

  it('falls back to the tool hotkey when more than one element is selected', () => {
    const { ui, controller, store } = setup()
    ui.selectedIds = new Set(['element-1', 'element-2'])

    press({ key: 'x' })

    expect(controller.beginLabelEditFromText).not.toHaveBeenCalled()
    expect(store.setUiState).toHaveBeenCalledWith({
      activeTool: 'shape',
      activeShapeType: 'hexagon',
    })
  })

  it('does not start a label edit while another edit is open', () => {
    const { ui, controller } = setup()
    ui.selectedIds = new Set(['element-1'])
    controller.activeEdit = { elementId: 'element-1' }

    press({ key: 'x' })

    expect(controller.beginLabelEditFromText).not.toHaveBeenCalled()
  })

  it('does not start a label edit while another tool is active', () => {
    const { ui, controller } = setup()
    ui.selectedIds = new Set(['element-1'])
    ui.activeTool = 'freedraw'

    press({ key: 'x' })

    expect(controller.beginLabelEditFromText).not.toHaveBeenCalled()
  })

  it('never treats a space as the start of a label', () => {
    const { ui, controller } = setup()
    ui.selectedIds = new Set(['element-1'])

    press({ key: ' ' })

    expect(controller.beginLabelEditFromText).not.toHaveBeenCalled()
  })
})

describe('useBoardActions scope', () => {
  it('stays out of the way while the user types in a field', () => {
    const { store } = setup()
    const input = document.createElement('input')
    document.body.appendChild(input)

    expect(press({ key: 'z', metaKey: true }, input)).toBe(false)
    expect(store.undo).not.toHaveBeenCalled()
  })

  it('stays out of the way inside an open dialog', () => {
    const { store } = setup()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const button = document.createElement('button')
    dialog.appendChild(button)
    document.body.appendChild(dialog)

    press({ key: 'h' }, button)

    expect(store.setUiState).not.toHaveBeenCalled()
  })
})

describe('useBoardActions arrow key nudge', () => {
  it('moves the selection by one point per arrow key', () => {
    const { ui, seed, snapshot, store } = setup()
    seed(element('a', { x: 10, y: 20 }))
    ui.selectedIds = new Set(['a'])

    expect(press({ key: 'ArrowRight' })).toBe(true)

    expect(snapshot.elements.a).toMatchObject({ x: 11, y: 20 })
    expect(store.transact).toHaveBeenCalledTimes(1)
  })

  it('moves the selection by ten points when shift is held', () => {
    const { ui, seed, snapshot } = setup()
    seed(element('a', { x: 10, y: 20 }))
    ui.selectedIds = new Set(['a'])

    press({ key: 'ArrowUp', shiftKey: true })

    expect(snapshot.elements.a).toMatchObject({ x: 10, y: 10 })
  })

  it('translates the points of a freehand element instead of its box', () => {
    const { ui, seed, snapshot } = setup()
    seed(
      element('a', {
        type: 'freedraw',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      }),
    )
    ui.selectedIds = new Set(['a'])

    press({ key: 'ArrowDown' })

    expect(snapshot.elements.a?.points).toEqual([
      { x: 0, y: 1 },
      { x: 10, y: 11 },
    ])
    expect(snapshot.elements.a).toMatchObject({ x: 0, y: 1, width: 10, height: 10 })
  })

  it('drags the whole group when one of its members is selected', () => {
    const { ui, seed, snapshot } = setup()
    seed(element('a', { groupId: 'g1' }), element('b', { groupId: 'g1' }))
    ui.selectedIds = new Set(['a'])

    press({ key: 'ArrowRight' })

    expect(snapshot.elements.a).toMatchObject({ x: 1 })
    expect(snapshot.elements.b).toMatchObject({ x: 1 })
    expect(announcements).toContain('Moved 2 elements right by 1')
  })

  it('announces the element it moved', () => {
    const { ui, seed } = setup()
    seed(element('a', { label: { text: 'Login' } }))
    ui.selectedIds = new Set(['a'])

    press({ key: 'ArrowLeft', shiftKey: true })

    expect(announcements).toContain('Moved Rectangle "Login" left by 10')
  })

  it('leaves a locked element where it is', () => {
    const { ui, seed, snapshot, store } = setup()
    seed(element('a', { locked: true }))
    ui.selectedIds = new Set(['a'])

    expect(press({ key: 'ArrowRight' })).toBe(false)

    expect(snapshot.elements.a).toMatchObject({ x: 0 })
    expect(store.transact).not.toHaveBeenCalled()
  })

  it('never moves anything on a read-only board', () => {
    const { ui, seed, snapshot, store } = setup(true)
    seed(element('a'))
    ui.selectedIds = new Set(['a'])

    expect(press({ key: 'ArrowRight' })).toBe(false)

    expect(store.transact).not.toHaveBeenCalled()
    expect(snapshot.elements.a).toMatchObject({ x: 0 })
    expect(announcements).toEqual([])
  })

  it('stays out of the way while a text label is being edited', () => {
    const { ui, seed, controller, store } = setup()
    seed(element('a'))
    ui.selectedIds = new Set(['a'])
    controller.activeEdit = { elementId: 'a' }

    expect(press({ key: 'ArrowRight' })).toBe(false)
    expect(store.transact).not.toHaveBeenCalled()
  })

  it('stays out of the way while the user types in a field', () => {
    const { ui, seed, store } = setup()
    seed(element('a'))
    ui.selectedIds = new Set(['a'])
    const input = document.createElement('input')
    document.body.appendChild(input)

    expect(press({ key: 'ArrowRight' }, input)).toBe(false)
    expect(store.transact).not.toHaveBeenCalled()
  })

  it('ignores arrow keys while nothing is selected', () => {
    const { seed, store } = setup()
    seed(element('a'))

    expect(press({ key: 'ArrowRight' })).toBe(false)
    expect(store.transact).not.toHaveBeenCalled()
  })

  it('leaves alt and arrow to the engine flow shortcut', () => {
    const { ui, seed, store } = setup()
    seed(element('a'))
    ui.selectedIds = new Set(['a'])

    expect(press({ key: 'ArrowRight', altKey: true })).toBe(false)
    expect(store.transact).not.toHaveBeenCalled()
  })
})

describe('useBoardActions element traversal', () => {
  it('selects the bottom element of the z-order on the first page down', () => {
    const { seed, store } = setup()
    seed(element('a'), element('b'), element('c'))

    expect(press({ key: 'PageDown' })).toBe(true)

    expect(store.setUiState).toHaveBeenCalledWith({
      selectedIds: new Set(['a']),
      activeTool: 'select',
    })
  })

  it('steps forward through the z-order and wraps at the top', () => {
    const { ui, seed, store } = setup()
    seed(element('a'), element('b'))
    ui.selectedIds = new Set(['b'])

    press({ key: 'PageDown' })

    expect(store.setUiState).toHaveBeenCalledWith({
      selectedIds: new Set(['a']),
      activeTool: 'select',
    })
  })

  it('steps backwards on page up and wraps to the top element', () => {
    const { seed, store } = setup()
    seed(element('a'), element('b'), element('c'))

    expect(press({ key: 'PageUp' })).toBe(true)

    expect(store.setUiState).toHaveBeenCalledWith({
      selectedIds: new Set(['c']),
      activeTool: 'select',
    })
  })

  it('carries the whole group along when it lands on a grouped element', () => {
    const { seed, store } = setup()
    seed(element('a', { groupId: 'g1' }), element('b', { groupId: 'g1' }))

    press({ key: 'PageDown' })

    expect(store.setUiState).toHaveBeenCalledWith({
      selectedIds: new Set(['a', 'b']),
      activeTool: 'select',
    })
  })

  it('skips locked elements', () => {
    const { seed, store } = setup()
    seed(element('a', { locked: true }), element('b'))

    press({ key: 'PageDown' })

    expect(store.setUiState).toHaveBeenCalledWith({
      selectedIds: new Set(['b']),
      activeTool: 'select',
    })
  })

  it('announces the traversed element and its place in the scene', () => {
    const { seed } = setup()
    seed(element('a'), element('b', { type: 'sticky' }), element('c'))

    press({ key: 'PageDown' })
    press({ key: 'PageDown' })

    expect(announcements).toEqual([
      'Rectangle, 1 of 3 selected',
      'Sticky note, 2 of 3 selected',
    ])
  })

  it('pans the viewport onto an element that sits off screen', () => {
    const { seed, controller } = setup()
    seed(element('a', { x: 2000, y: 0 }))

    press({ key: 'PageDown' })

    expect(controller.focusViewport).toHaveBeenCalledWith({ x: 1650, y: -275, zoom: 1 })
  })

  it('leaves the viewport alone for an element that is already visible', () => {
    const { seed, controller } = setup()
    seed(element('a', { x: 10, y: 20 }))

    press({ key: 'PageDown' })

    expect(controller.focusViewport).not.toHaveBeenCalled()
  })

  it('still traverses on a read-only board', () => {
    const { seed, store } = setup(true)
    seed(element('a'))

    expect(press({ key: 'PageDown' })).toBe(true)
    expect(store.setUiState).toHaveBeenCalledWith({
      selectedIds: new Set(['a']),
      activeTool: 'select',
    })
  })

  it('says so when the board has nothing to traverse', () => {
    const { store } = setup()

    expect(press({ key: 'PageDown' })).toBe(true)

    expect(store.setUiState).not.toHaveBeenCalled()
    expect(announcements).toEqual(['The board has no elements'])
  })

  it('stays out of the way while a text label is being edited', () => {
    const { seed, controller, store } = setup()
    seed(element('a'))
    controller.activeEdit = { elementId: 'a' }

    expect(press({ key: 'PageDown' })).toBe(false)
    expect(store.setUiState).not.toHaveBeenCalled()
  })
})

describe('useBoardActions selection announcements', () => {
  it('announces a selection made from anywhere, not only the keyboard', () => {
    const { seed, store } = setup()
    seed(element('a'), element('b'))

    store.setUiState({ selectedIds: new Set(['a', 'b']) })

    expect(announcements).toEqual(['2 of 2 elements selected'])
  })

  it('announces an emptied selection', () => {
    const { seed, store } = setup()
    seed(element('a'))

    store.setUiState({ selectedIds: new Set<string>() })

    expect(announcements).toEqual(['Nothing selected'])
  })

  it('stops announcing once the board unmounts', () => {
    const { seed, store, unmount } = setup()
    seed(element('a'))

    unmount()
    store.setUiState({ selectedIds: new Set(['a']) })

    expect(announcements).toEqual([])
  })
})

describe('useBoardActions lifecycle', () => {
  it('reads the latest context without rebinding the listener', () => {
    const { store, rerender } = setup()

    rerender({ readOnly: true })
    press({ key: 'z', metaKey: true })

    expect(store.undo).not.toHaveBeenCalled()
  })

  it('detaches the listener on unmount', () => {
    const { store, unmount } = setup()

    unmount()

    expect(press({ key: 'z', metaKey: true })).toBe(false)
    expect(store.undo).not.toHaveBeenCalled()
  })
})
