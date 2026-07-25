import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SCENE_CLIPBOARD_VERSION,
  createShape,
  type EditorController,
  type SceneClipboardPayload,
  type SceneStore,
} from '@freedraw/engine'
import { BOARD_CLIPBOARD_MIME, useBoardClipboard } from './use-board-clipboard.js'

function payload(id = 'clip'): SceneClipboardPayload {
  return {
    version: SCENE_CLIPBOARD_VERSION,
    id,
    elements: [createShape({ id: 'shape-1', x: 0, y: 0, width: 10, height: 10 })],
  }
}

function createStore(pasted: string[] = ['pasted']) {
  return {
    getUiState: vi.fn(() => ({ selectedIds: new Set(['a']) })),
    copyElements: vi.fn<(ids: Iterable<string>) => SceneClipboardPayload | null>(() => payload()),
    cutElements: vi.fn<(ids: Iterable<string>) => SceneClipboardPayload | null>(() => payload()),
    pasteElements: vi.fn(() => pasted),
  }
}

type FakeStore = ReturnType<typeof createStore>

const cursor = { x: 12, y: 34 }

function createController() {
  return { cursorWorldPoint: cursor }
}

function createClipboardData(initial: Record<string, string> = {}, types: string[] = []) {
  const stored: Record<string, string> = { ...initial }
  return {
    getData: vi.fn((type: string) => stored[type] ?? ''),
    setData: vi.fn((type: string, value: string) => {
      stored[type] = value
    }),
    items: types.map((type) => ({ type })),
  }
}

type FakeClipboardData = ReturnType<typeof createClipboardData>

function setup(store: FakeStore, controller: ReturnType<typeof createController> | null = createController()) {
  return renderHook(() =>
    useBoardClipboard(
      store as unknown as SceneStore,
      controller as unknown as EditorController | null,
    ),
  )
}

function fire(type: string, data: FakeClipboardData | null, target?: HTMLElement): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  ;(target ?? window).dispatchEvent(event)
  return event
}

function mount(tag: string, parentAttribute?: [string, string]): HTMLElement {
  const element = document.createElement(tag)
  if (parentAttribute) {
    const parent = document.createElement('div')
    parent.setAttribute(parentAttribute[0], parentAttribute[1])
    parent.append(element)
    document.body.append(parent)
    return element
  }
  document.body.append(element)
  return element
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useBoardClipboard copy', () => {
  it('writes the copied payload onto the event and claims it', () => {
    const store = createStore()
    setup(store)

    const data = createClipboardData()
    const event = fire('copy', data)

    expect([...store.copyElements.mock.calls[0][0]]).toEqual(['a'])
    expect(data.setData).toHaveBeenCalledWith(BOARD_CLIPBOARD_MIME, JSON.stringify(payload()))
    expect(data.setData).toHaveBeenCalledWith('text/plain', 'FreeDraw board elements')
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves the event to the browser when nothing is selected', () => {
    const store = createStore()
    store.copyElements.mockReturnValue(null)
    setup(store)

    const data = createClipboardData()
    const event = fire('copy', data)

    expect(data.setData).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores a copy raised while editing text', () => {
    const store = createStore()
    setup(store)

    fire('copy', createClipboardData(), mount('input'))

    expect(store.copyElements).not.toHaveBeenCalled()
  })

  it('ignores a copy raised from inside an open menu', () => {
    const store = createStore()
    setup(store)

    fire('copy', createClipboardData(), mount('span', ['role', 'dialog']))

    expect(store.copyElements).not.toHaveBeenCalled()
  })
})

describe('useBoardClipboard cut', () => {
  it('writes the cut payload onto the event and claims it', () => {
    const store = createStore()
    setup(store)

    const data = createClipboardData()
    const event = fire('cut', data)

    expect(store.cutElements).toHaveBeenCalledTimes(1)
    expect(data.setData).toHaveBeenCalledWith(BOARD_CLIPBOARD_MIME, JSON.stringify(payload()))
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves the event alone when the cut produced nothing', () => {
    const store = createStore()
    store.cutElements.mockReturnValue(null)
    setup(store)

    const data = createClipboardData()
    const event = fire('cut', data)

    expect(data.setData).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores a cut raised while editing text', () => {
    const store = createStore()
    setup(store)

    fire('cut', createClipboardData(), mount('textarea'))

    expect(store.cutElements).not.toHaveBeenCalled()
  })
})

describe('useBoardClipboard paste', () => {
  it('pastes the carried payload at the cursor', () => {
    const store = createStore()
    setup(store)

    const data = createClipboardData({ [BOARD_CLIPBOARD_MIME]: JSON.stringify(payload()) })
    const event = fire('paste', data)

    expect(store.pasteElements).toHaveBeenCalledWith({ payload: payload(), target: cursor })
    expect(event.defaultPrevented).toBe(true)
  })

  it('pastes without a target when there is no controller', () => {
    const store = createStore()
    setup(store, null)

    fire('paste', createClipboardData({ [BOARD_CLIPBOARD_MIME]: JSON.stringify(payload()) }))

    expect(store.pasteElements).toHaveBeenCalledWith({ payload: payload(), target: undefined })
  })

  it('falls back to the internal clipboard when the event carries nothing', () => {
    const store = createStore()
    setup(store)

    fire('paste', createClipboardData())

    expect(store.pasteElements).toHaveBeenCalledWith({ target: cursor })
  })

  it('leaves an image paste to the image insert handler', () => {
    const store = createStore()
    setup(store)

    const event = fire('paste', createClipboardData({}, ['image/png']))

    expect(store.pasteElements).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('drops a board payload it cannot parse', () => {
    const store = createStore()
    setup(store)

    const event = fire('paste', createClipboardData({ [BOARD_CLIPBOARD_MIME]: 'not json' }))

    expect(store.pasteElements).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves the event alone when nothing was pasted', () => {
    const store = createStore([])
    setup(store)

    const event = fire('paste', createClipboardData())

    expect(store.pasteElements).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
  })

  it('ignores a paste raised while editing text', () => {
    const store = createStore()
    setup(store)

    fire('paste', createClipboardData(), mount('input'))

    expect(store.pasteElements).not.toHaveBeenCalled()
  })
})

describe('useBoardClipboard teardown', () => {
  it('detaches every listener on unmount', () => {
    const store = createStore()
    const { unmount } = setup(store)

    unmount()
    fire('copy', createClipboardData())
    fire('cut', createClipboardData())
    fire('paste', createClipboardData())

    expect(store.copyElements).not.toHaveBeenCalled()
    expect(store.cutElements).not.toHaveBeenCalled()
    expect(store.pasteElements).not.toHaveBeenCalled()
  })
})
