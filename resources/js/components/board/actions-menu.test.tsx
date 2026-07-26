import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createArrow, createShape, defaultStyle } from '@freedraw/engine'
import type { Element, EditorController, SceneStore } from '@freedraw/engine'
import type { BoardExport } from '@/hooks/board/use-export.js'
import { ActionsMenu } from './actions-menu.js'
import { BoardProvider, type BoardContextValue } from './board-context.js'

interface StoreState {
  canUndo?: boolean
  canRedo?: boolean
  selectedIds?: string[]
  clipboardElementCount?: number
  snapGuidesEnabled?: boolean
  elements?: Element[]
}

function connectedGraph(): Element[] {
  return [
    createShape({ id: 'n1', type: 'rect', x: 0, y: 0, width: 120, height: 80 }),
    createShape({ id: 'n2', type: 'rect', x: 480, y: 360, width: 120, height: 80 }),
    createArrow({
      id: 'e1',
      points: [
        { x: 120, y: 40 },
        { x: 480, y: 400 },
      ],
      start: { elementId: 'n1', anchor: { nx: 1, ny: 0.5 }, gap: 0, side: 'right' },
      end: { elementId: 'n2', anchor: { nx: 0, ny: 0.5 }, gap: 0, side: 'left' },
    }),
  ]
}

function createStore(state: StoreState = {}) {
  const ui = {
    selectedIds: new Set(state.selectedIds ?? []),
    clipboardElementCount: state.clipboardElementCount ?? 0,
  }
  const graph = state.elements ?? []
  const snapshot = {
    order: graph.length > 0 ? graph.map((element) => element.id) : [...(state.selectedIds ?? [])],
    elements: Object.fromEntries(graph.map((element) => [element.id, element])),
    appState: { snapGuidesEnabled: state.snapGuidesEnabled ?? false, lastUsedStyle: defaultStyle },
  }
  const updateElement = vi.fn()

  return {
    canUndo: state.canUndo ?? false,
    canRedo: state.canRedo ?? false,
    subscribe: () => () => {},
    subscribeUi: () => () => {},
    subscribeHistory: () => () => {},
    getUiState: () => ui,
    getSnapshot: () => snapshot,
    undo: vi.fn(),
    redo: vi.fn(),
    deleteElements: vi.fn(),
    duplicateElements: vi.fn(),
    copyElements: vi.fn(),
    cutElements: vi.fn(),
    pasteElements: vi.fn(),
    setSnapGuidesEnabled: vi.fn(),
    stopCapturing: vi.fn(),
    transact: vi.fn((run: (api: { updateElement: typeof updateElement }) => void) =>
      run({ updateElement }),
    ),
    updateElement,
  }
}

type FakeStore = ReturnType<typeof createStore>

const boardExport = {
  exportImage: vi.fn(),
  exportSvg: vi.fn(),
  copyImage: vi.fn(),
  exportScene: vi.fn(),
  importScene: vi.fn(),
} as unknown as BoardExport

const controller = { cursorWorldPoint: { x: 5, y: 7 } }

function boardValue(store: FakeStore, readOnly: boolean): BoardContextValue {
  return {
    store: store as unknown as SceneStore,
    controller: controller as unknown as EditorController,
    boardExport,
    theme: 'light',
    readOnly,
    scope: readOnly ? 'view' : 'edit',
    openImagePicker: vi.fn(),
    sync: null,
  }
}

function everything(): StoreState {
  return {
    canUndo: true,
    canRedo: true,
    selectedIds: ['a', 'b'],
    clipboardElementCount: 1,
    snapGuidesEnabled: false,
  }
}

async function openMenu(state: StoreState = everything(), readOnly = false) {
  const store = createStore(state)

  render(
    createElement(BoardProvider, {
      value: boardValue(store, readOnly),
      children: createElement(ActionsMenu, {
        store: store as unknown as SceneStore,
        controller: controller as unknown as EditorController,
        boardExport,
        theme: 'light',
        children: createElement('button', { type: 'button' }, 'Actions menu'),
      }),
    }),
  )

  fireEvent.pointerDown(screen.getByText('Actions menu'), { button: 0, ctrlKey: false })
  await screen.findByText('Undo')

  return store
}

function entry(label: string): HTMLElement {
  const found = screen.getByText(label).closest('[role="menuitem"]')
  if (!found) throw new Error(`Missing menu entry ${label}`)
  return found as HTMLElement
}

function isDisabled(label: string): boolean {
  return entry(label).getAttribute('aria-disabled') === 'true'
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ActionsMenu entries', () => {
  it('lists the edit actions and the snap toggle', async () => {
    await openMenu()

    for (const label of ['Undo', 'Redo', 'Delete', 'Duplicate', 'Copy', 'Cut', 'Paste']) {
      expect(isDisabled(label)).toBe(false)
    }
    expect(isDisabled('Snap guides')).toBe(false)
  })

  it('shows the keyboard shortcut alongside an action', async () => {
    await openMenu()

    expect(entry('Undo').textContent).toContain('⌘Z')
  })

  it('disables the actions their gate rejects', async () => {
    await openMenu({})

    expect(isDisabled('Undo')).toBe(true)
    expect(isDisabled('Redo')).toBe(true)
    expect(isDisabled('Delete')).toBe(true)
    expect(isDisabled('Duplicate')).toBe(true)
    expect(isDisabled('Copy')).toBe(true)
    expect(isDisabled('Paste')).toBe(true)
    expect(isDisabled('Snap guides')).toBe(false)
  })

  it('disables every mutating action on a read-only board but keeps copy', async () => {
    await openMenu(everything(), true)

    for (const label of ['Undo', 'Redo', 'Delete', 'Duplicate', 'Cut', 'Paste']) {
      expect(isDisabled(label)).toBe(true)
    }
    expect(isDisabled('Snap guides')).toBe(true)
    expect(isDisabled('Copy')).toBe(false)
  })

  it('still copies from a read-only board', async () => {
    const store = await openMenu(everything(), true)

    fireEvent.click(entry('Copy'))

    expect([...store.copyElements.mock.calls[0][0]]).toEqual(['a', 'b'])
  })

  it('offers Tidy diagram but gates it on a connected graph', async () => {
    await openMenu()

    expect(isDisabled('Tidy diagram')).toBe(true)
  })

  it('enables Tidy diagram once the scene holds a connected graph', async () => {
    await openMenu({ elements: connectedGraph() })

    expect(isDisabled('Tidy diagram')).toBe(false)
  })

  it('disables Tidy diagram on a read-only board', async () => {
    await openMenu({ elements: connectedGraph() }, true)

    expect(isDisabled('Tidy diagram')).toBe(true)
  })
})

describe('ActionsMenu behaviour', () => {
  it('runs the picked action against the store', async () => {
    const store = await openMenu()

    fireEvent.click(entry('Undo'))

    expect(store.undo).toHaveBeenCalledTimes(1)
    expect(store.redo).not.toHaveBeenCalled()
  })

  it('pastes at the cursor', async () => {
    const store = await openMenu()

    fireEvent.click(entry('Paste'))

    expect(store.pasteElements).toHaveBeenCalledWith({ target: controller.cursorWorldPoint })
  })

  it('ignores clicks on a gated action', async () => {
    const store = await openMenu({})

    fireEvent.click(entry('Undo'))

    expect(store.undo).not.toHaveBeenCalled()
  })

  it('toggles snap guides without closing the menu', async () => {
    const store = await openMenu()

    fireEvent.click(entry('Snap guides'))

    expect(store.setSnapGuidesEnabled).toHaveBeenCalledWith(true)
    expect(screen.queryByText('Undo')).not.toBeNull()
  })

  it('turns snap guides back off and marks them as on', async () => {
    const store = await openMenu({ ...everything(), snapGuidesEnabled: true })

    fireEvent.click(entry('Snap guides'))

    expect(store.setSnapGuidesEnabled).toHaveBeenCalledWith(false)
  })

  it('reflows the connected graph through one transaction when Tidy runs', async () => {
    const store = await openMenu({ elements: connectedGraph() })

    fireEvent.click(entry('Tidy diagram'))

    const ids = store.updateElement.mock.calls.map(([id]) => id)
    expect(store.transact).toHaveBeenCalledTimes(1)
    expect(ids).toContain('n2')
    expect(ids.every((id) => id === 'n1' || id === 'n2')).toBe(true)
    for (const [, patch] of store.updateElement.mock.calls) {
      expect(Object.keys(patch).sort()).toEqual(['x', 'y'])
    }
  })

  it('ignores a Tidy click when there is no connected graph', async () => {
    const store = await openMenu()

    fireEvent.click(entry('Tidy diagram'))

    expect(store.transact).not.toHaveBeenCalled()
  })

  it('closes after running a one-shot action', async () => {
    await openMenu()

    fireEvent.click(entry('Duplicate'))

    await waitFor(() => {
      expect(screen.queryByText('Undo')).toBeNull()
    })
  })
})
