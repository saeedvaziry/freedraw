import type { EditorController, SceneStore } from '@freedraw/engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardExport } from '@/hooks/board/use-export.js'
import { boardToast } from '@/lib/board-toast'
import {
  BOARD_ACTIONS,
  BOARD_ACTIONS_BY_ID,
  SCENE_IMPORT_EVENT,
  type BoardAction,
  type BoardActionContext,
} from './board-actions.js'

vi.mock('@/lib/board-toast', () => ({
  boardToast: vi.fn(),
}))

const toast = vi.mocked(boardToast)

interface StoreState {
  canUndo?: boolean
  canRedo?: boolean
  selectedIds?: string[]
  order?: string[]
  elements?: Record<string, { groupId?: string | null; locked?: boolean }>
  clipboardElementCount?: number
  activeTool?: string
  toolLock?: boolean
  snapGuidesEnabled?: boolean
}

function createStore(state: StoreState = {}) {
  const ui = {
    selectedIds: new Set(state.selectedIds ?? []),
    activeTool: state.activeTool ?? 'select',
    activeShapeType: 'rectangle',
    activeStickyColor: 'yellow',
    clipboardElementCount: state.clipboardElementCount ?? 0,
    toolLock: state.toolLock ?? false,
  }
  const snapshot = {
    order: state.order ?? [],
    elements: state.elements ?? {},
    appState: { snapGuidesEnabled: state.snapGuidesEnabled ?? false },
  }

  return {
    canUndo: state.canUndo ?? false,
    canRedo: state.canRedo ?? false,
    getUiState: vi.fn(() => ui),
    getSnapshot: vi.fn(() => snapshot),
    setUiState: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    deleteElements: vi.fn(),
    duplicateElements: vi.fn(),
    groupElements: vi.fn(),
    ungroupElements: vi.fn(),
    lockElements: vi.fn(),
    unlockElements: vi.fn(),
    unlockAll: vi.fn(),
    bringToFront: vi.fn(),
    bringForward: vi.fn(),
    sendBackward: vi.fn(),
    sendToBack: vi.fn(),
    alignElements: vi.fn(),
    distributeElements: vi.fn(),
    copyElements: vi.fn(),
    cutElements: vi.fn(),
    pasteElements: vi.fn(),
    setSnapGuidesEnabled: vi.fn(),
  }
}

type FakeStore = ReturnType<typeof createStore>

function createController() {
  return {
    zoomToFit: vi.fn(),
    zoomToActualSize: vi.fn(),
    cursorWorldPoint: { x: 10, y: 20 },
  }
}

type FakeController = ReturnType<typeof createController>

const boardExport = {
  exportImage: vi.fn(),
  copyImage: vi.fn(),
  exportScene: vi.fn(),
  importScene: vi.fn(),
} as unknown as BoardExport

interface CtxOptions {
  readOnly?: boolean
  controller?: FakeController | null
}

function makeCtx(store: FakeStore, options: CtxOptions = {}): BoardActionContext {
  return {
    store: store as unknown as SceneStore,
    controller: (options.controller ?? null) as unknown as EditorController | null,
    boardExport,
    theme: 'light',
    readOnly: options.readOnly ?? false,
    openImagePicker: vi.fn(),
  }
}

function action(id: string): BoardAction {
  const found = BOARD_ACTIONS_BY_ID[id]
  if (!found) {
    throw new Error(`Unknown action ${id}`)
  }

  return found
}

function richState(): StoreState {
  return {
    canUndo: true,
    canRedo: true,
    selectedIds: ['a', 'b', 'c'],
    order: ['a', 'b', 'c'],
    elements: {
      a: { groupId: 'g1', locked: true },
      b: { groupId: 'g1', locked: true },
      c: { groupId: 'g1', locked: true },
    },
    clipboardElementCount: 1,
  }
}

const READ_ONLY_SAFE_IDS = new Set([
  'copy',
  'copy-link',
  'select-all',
  'deselect',
  'zoom-to-fit',
  'zoom-actual-size',
  'command.open',
  'help.open',
  'export-png',
  'export-jpg',
  'export-json',
  'copy-image',
])

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BOARD_ACTIONS registry', () => {
  it('indexes every action by a unique id', () => {
    const ids = BOARD_ACTIONS.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(BOARD_ACTIONS.length)
    expect(Object.keys(BOARD_ACTIONS_BY_ID).length).toBe(BOARD_ACTIONS.length)
    for (const entry of BOARD_ACTIONS) {
      expect(BOARD_ACTIONS_BY_ID[entry.id]).toBe(entry)
    }
  })

  it('gives every action the required shape', () => {
    for (const entry of BOARD_ACTIONS) {
      expect(typeof entry.id).toBe('string')
      expect(typeof entry.label).toBe('string')
      expect(typeof entry.icon).toBeDefined()
      expect(typeof entry.when).toBe('function')
      expect(typeof entry.run).toBe('function')
    }
  })

  it('runs mutating actions against the store', () => {
    const store = createStore(richState())
    const controller = createController()
    const ctx = makeCtx(store, { controller })

    action('undo').run(ctx)
    expect(store.undo).toHaveBeenCalledTimes(1)

    action('redo').run(ctx)
    expect(store.redo).toHaveBeenCalledTimes(1)

    action('delete').run(ctx)
    expect(store.deleteElements).toHaveBeenCalledWith(store.getUiState().selectedIds)

    action('duplicate').run(ctx)
    expect(store.duplicateElements).toHaveBeenCalledWith(store.getUiState().selectedIds)

    action('group').run(ctx)
    expect(store.groupElements).toHaveBeenCalledWith(store.getUiState().selectedIds)

    action('ungroup').run(ctx)
    expect(store.ungroupElements).toHaveBeenCalledWith(store.getUiState().selectedIds)

    action('align-left').run(ctx)
    expect(store.alignElements).toHaveBeenCalledWith(store.getUiState().selectedIds, 'left')

    action('distribute-horizontal').run(ctx)
    expect(store.distributeElements).toHaveBeenCalledWith(store.getUiState().selectedIds, 'horizontal')

    action('copy').run(ctx)
    expect(store.copyElements).toHaveBeenCalledWith(store.getUiState().selectedIds)

    action('cut').run(ctx)
    expect(store.cutElements).toHaveBeenCalledWith(store.getUiState().selectedIds)

    action('paste').run(ctx)
    expect(store.pasteElements).toHaveBeenCalledWith({ target: controller.cursorWorldPoint })
  })

  it('unlocks only the locked subset of the selection', () => {
    const store = createStore({
      selectedIds: ['a', 'b', 'c'],
      order: ['a', 'b', 'c'],
      elements: {
        a: { locked: true },
        b: { locked: false },
        c: { locked: true },
      },
    })
    action('unlock-selection').run(makeCtx(store))
    expect(store.unlockElements).toHaveBeenCalledWith(['a', 'c'])
  })

  it('selects every element for select-all', () => {
    const store = createStore({ order: ['a', 'b', 'c'] })
    action('select-all').run(makeCtx(store))
    const arg = store.setUiState.mock.calls[0][0] as { selectedIds: Set<string> }
    expect([...arg.selectedIds]).toEqual(['a', 'b', 'c'])
  })

  it('toggles snap guides based on the current snapshot', () => {
    const store = createStore({ snapGuidesEnabled: false })
    action('toggle-snap-guides').run(makeCtx(store))
    expect(store.setSnapGuidesEnabled).toHaveBeenCalledWith(true)
  })

  it('drives view actions through the controller', () => {
    const controller = createController()
    const ctx = makeCtx(createStore(), { controller })
    action('zoom-to-fit').run(ctx)
    expect(controller.zoomToFit).toHaveBeenCalledTimes(1)
    action('zoom-actual-size').run(ctx)
    expect(controller.zoomToActualSize).toHaveBeenCalledTimes(1)
  })

  it('dispatches the import event for import-json', () => {
    const listener = vi.fn()
    window.addEventListener(SCENE_IMPORT_EVENT, listener)
    action('import-json').run(makeCtx(createStore()))
    window.removeEventListener(SCENE_IMPORT_EVENT, listener)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('gates actions by selection and state through when()', () => {
    const empty = makeCtx(createStore())
    expect(action('undo').when(empty)).toBe(false)
    expect(action('delete').when(empty)).toBe(false)
    expect(action('group').when(empty)).toBe(false)
    expect(action('select-all').when(empty)).toBe(false)
    expect(action('paste').when(empty)).toBe(false)
    expect(action('zoom-to-fit').when(empty)).toBe(false)

    const rich = makeCtx(createStore(richState()), { controller: createController() })
    expect(action('undo').when(rich)).toBe(true)
    expect(action('delete').when(rich)).toBe(true)
    expect(action('group').when(rich)).toBe(true)
    expect(action('distribute-horizontal').when(rich)).toBe(true)
    expect(action('paste').when(rich)).toBe(true)
    expect(action('zoom-to-fit').when(rich)).toBe(true)

    const twoSelected = makeCtx(
      createStore({ selectedIds: ['a', 'b'], order: ['a', 'b'] }),
    )
    expect(action('align-left').when(twoSelected)).toBe(true)
    expect(action('distribute-horizontal').when(twoSelected)).toBe(false)
  })

  it('matches keyboard shortcuts', () => {
    const undo = action('undo')
    expect(undo.match?.(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))).toBe(true)
    expect(
      undo.match?.(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true })),
    ).toBe(false)

    const redo = action('redo')
    expect(
      redo.match?.(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true })),
    ).toBe(true)

    expect(
      action('select-all').match?.(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true })),
    ).toBe(true)
    expect(action('deselect').match?.(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(true)
    expect(action('delete').match?.(new KeyboardEvent('keydown', { key: 'Backspace' }))).toBe(true)
  })
})

describe('read-only gating (fd-orb)', () => {
  it('keeps every action enabled in a fully-populated editable board', () => {
    const ctx = makeCtx(createStore(richState()), { controller: createController() })
    const enabled = BOARD_ACTIONS.filter((entry) => entry.when(ctx))
    expect(enabled.length).toBe(BOARD_ACTIONS.length)
  })

  it('disables mutating actions but leaves read-safe actions when readOnly', () => {
    const store = createStore(richState())
    const controller = createController()
    const ctx = makeCtx(store, { readOnly: true, controller })

    for (const entry of BOARD_ACTIONS) {
      if (READ_ONLY_SAFE_IDS.has(entry.id)) {
        expect(entry.when(ctx)).toBe(true)
      } else {
        expect(entry.when(ctx)).toBe(false)
      }
    }
  })

  it('does not fire mutating handlers when the read-only gate blocks them', () => {
    const store = createStore(richState())
    const ctx = makeCtx(store, { readOnly: true })
    const undo = action('undo')
    if (undo.when(ctx)) {
      undo.run(ctx)
    }
    expect(store.undo).not.toHaveBeenCalled()
  })
})

describe('clipboard failure path (fd-xgl)', () => {
  it('reports success when the clipboard write resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    action('copy-link').run(makeCtx(createStore()))

    await vi.waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Link copied')
    })
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })

  it('reports an error when the clipboard write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    action('copy-link').run(makeCtx(createStore()))

    await vi.waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Could not copy the link', 'error')
    })
  })

  it('reports an error when the clipboard API is unsupported', () => {
    vi.stubGlobal('navigator', { clipboard: undefined })

    action('copy-link').run(makeCtx(createStore()))

    expect(toast).toHaveBeenCalledWith('Could not copy the link', 'error')
    expect(toast).toHaveBeenCalledTimes(1)
  })
})
