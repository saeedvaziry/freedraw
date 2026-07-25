import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardActionContext } from '@/components/board/board-actions.js'
import { useBoardActions } from './use-board-actions.js'

interface FakeUiState {
  activeTool: string
  activeShapeType: string
  selectedIds: Set<string>
  toolLock: boolean
  clipboardElementCount: number
}

function fakeStore() {
  const ui: FakeUiState = {
    activeTool: 'select',
    activeShapeType: 'rect',
    selectedIds: new Set<string>(),
    toolLock: false,
    clipboardElementCount: 0,
  }
  const snapshot = { elements: {}, order: [] as string[], appState: { snapGuidesEnabled: true } }

  return {
    ui,
    snapshot,
    store: {
      canUndo: true,
      canRedo: true,
      undo: vi.fn(),
      redo: vi.fn(),
      deleteElements: vi.fn(),
      getUiState: () => ui,
      getSnapshot: () => snapshot,
      setUiState: vi.fn(),
    },
  }
}

function fakeController() {
  return {
    isReadOnly: false,
    activeEdit: null as unknown,
    cursorWorldPoint: { x: 0, y: 0 },
    beginLabelEditFromText: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
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
