import { renderHook, waitFor } from '@testing-library/react'
import type { ChangeEvent, DragEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SCENE_CLIPBOARD_VERSION,
  createShape,
  defaultStyle,
  type EditorController,
  type Element,
  type ImageElement,
  type SceneStore,
} from '@freedraw/engine'
import type { AssetSource } from '@/lib/persistence'
import { BOARD_CLIPBOARD_MIME } from './use-board-clipboard.js'

const { persistence } = vi.hoisted(() => ({
  persistence: {
    assetRepo: { putAsset: vi.fn(), getAsset: vi.fn() },
    createAssetLoader: vi.fn(),
    uploadPageAsset: vi.fn(),
  },
}))

vi.mock('@/lib/persistence', () => persistence)

import { useImageInsert } from './use-image-insert.js'

const bitmap = { width: 400, height: 200 }

const loader = vi.fn()

function createController() {
  return {
    viewportSize: { width: 1000, height: 800 },
    screenToWorld: vi.fn((point: { x: number; y: number }) => ({
      x: point.x * 2,
      y: point.y * 2,
    })),
    cacheImageBitmap: vi.fn(),
    setImageBlobLoader: vi.fn(),
  }
}

type FakeController = ReturnType<typeof createController>

function createStore() {
  const added: Element[] = []
  return {
    added,
    getLastUsedStyle: vi.fn(() => defaultStyle),
    stopCapturing: vi.fn(),
    setUiState: vi.fn(),
    transact: vi.fn((run: (api: { addElement(element: Element): void }) => void) =>
      run({ addElement: (element) => added.push(element) }),
    ),
  }
}

type FakeStore = ReturnType<typeof createStore>

const pageSource: AssetSource = { kind: 'page', publicId: 'abc' }

function setup(
  controller: FakeController | null,
  store: FakeStore,
  source: AssetSource = pageSource,
) {
  return renderHook(() =>
    useImageInsert(
      controller as unknown as EditorController | null,
      store as unknown as SceneStore,
      source,
    ),
  )
}

function imageBlob(type = 'image/png', size = 1024): File {
  return { type, size } as unknown as File
}

function changeEvent(file: File | null) {
  const target = { files: file ? [file] : [], value: 'C:/fake/path.png' }
  return { target } as unknown as ChangeEvent<HTMLInputElement>
}

function dropEvent(files: File[]) {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { files },
    currentTarget: { getBoundingClientRect: () => ({ left: 10, top: 20 }) },
    clientX: 60,
    clientY: 120,
  } as unknown as DragEvent
}

function firePaste(data: Record<string, string>, types: string[], file: File | null): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => data[type] ?? '',
      items: types.map((type) => ({ type, getAsFile: () => file })),
    },
  })
  window.dispatchEvent(event)
  return event
}

function boardClipboardJson(): string {
  return JSON.stringify({
    version: SCENE_CLIPBOARD_VERSION,
    id: 'clip',
    elements: [createShape({ id: 'shape-1', x: 0, y: 0, width: 10, height: 10 })],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(() => Promise.resolve(bitmap)),
  )
  persistence.assetRepo.putAsset.mockResolvedValue(undefined)
  persistence.uploadPageAsset.mockResolvedValue(undefined)
  persistence.createAssetLoader.mockReturnValue(loader)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useImageInsert asset loader', () => {
  it('installs a loader built for the board source', () => {
    const controller = createController()
    setup(controller, createStore())

    expect(persistence.createAssetLoader).toHaveBeenCalledWith(pageSource)
    expect(controller.setImageBlobLoader).toHaveBeenCalledWith(loader)
  })

  it('installs nothing while there is no controller', () => {
    setup(null, createStore())

    expect(persistence.createAssetLoader).not.toHaveBeenCalled()
  })
})

describe('useImageInsert file picker', () => {
  it('clicks the hidden input it owns', () => {
    const { result } = setup(createController(), createStore())
    const click = vi.fn()
    result.current.fileInputRef.current = { click } as unknown as HTMLInputElement

    result.current.openPicker()

    expect(click).toHaveBeenCalledTimes(1)
  })

  it('survives an unmounted input', () => {
    const { result } = setup(createController(), createStore())

    expect(() => result.current.openPicker()).not.toThrow()
  })

  it('clears the input value and inserts the chosen file', async () => {
    const store = createStore()
    const { result } = setup(createController(), store)
    const event = changeEvent(imageBlob())

    result.current.onFileInputChange(event)

    expect(event.target.value).toBe('')
    await waitFor(() => {
      expect(store.added).toHaveLength(1)
    })
  })

  it('does nothing when the picker was dismissed', () => {
    const store = createStore()
    const { result } = setup(createController(), store)

    result.current.onFileInputChange(changeEvent(null))

    expect(persistence.assetRepo.putAsset).not.toHaveBeenCalled()
  })
})

describe('useImageInsert rejections', () => {
  it('refuses a file that is not an image', async () => {
    const store = createStore()
    const { result } = setup(createController(), store)

    result.current.onFileInputChange(changeEvent(imageBlob('application/pdf')))
    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith('Image rejected: mime')
    })

    expect(persistence.assetRepo.putAsset).not.toHaveBeenCalled()
    expect(store.added).toHaveLength(0)
  })

  it('refuses an image past the size limit', async () => {
    const store = createStore()
    const { result } = setup(createController(), store)

    result.current.onFileInputChange(changeEvent(imageBlob('image/png', 11 * 1024 * 1024)))
    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith('Image rejected: size')
    })

    expect(store.added).toHaveLength(0)
  })

  it('inserts nothing at all without a controller', async () => {
    const store = createStore()
    const { result } = setup(null, store)

    result.current.onFileInputChange(changeEvent(imageBlob()))
    await Promise.resolve()

    expect(persistence.assetRepo.putAsset).not.toHaveBeenCalled()
    expect(store.added).toHaveLength(0)
  })
})

describe('useImageInsert drop', () => {
  it('always claims the drag over so the browser never opens the file', () => {
    const { result } = setup(createController(), createStore())
    const event = dropEvent([])

    result.current.onDragOver(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('places the dropped image at the pointer in world space', async () => {
    const controller = createController()
    const store = createStore()
    const { result } = setup(controller, store)
    const dropped = imageBlob()

    result.current.onDrop(dropEvent([dropped]))

    await waitFor(() => {
      expect(store.added).toHaveLength(1)
    })
    expect(controller.screenToWorld).toHaveBeenCalledWith({ x: 50, y: 100 })
    expect(store.added[0].x).toBe(100 - store.added[0].width / 2)
    expect(store.added[0].y).toBe(200 - store.added[0].height / 2)
    expect(controller.cacheImageBitmap).toHaveBeenCalledTimes(1)
    expect(controller.cacheImageBitmap).toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
      dropped,
    )
    expect(store.setUiState).toHaveBeenCalledWith({
      selectedIds: new Set([store.added[0].id]),
      activeTool: 'select',
    })
  })

  it('centres a pasted image in the viewport instead', async () => {
    const controller = createController()
    const store = createStore()
    const { result } = setup(controller, store)

    result.current.onFileInputChange(changeEvent(imageBlob()))

    await waitFor(() => {
      expect(store.added).toHaveLength(1)
    })
    expect(controller.screenToWorld).toHaveBeenCalledWith({ x: 500, y: 400 })
  })

  it('ignores a drop that carries no image', async () => {
    const store = createStore()
    const { result } = setup(createController(), store)
    const event = dropEvent([imageBlob('text/plain')])

    result.current.onDrop(event)
    await Promise.resolve()

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(store.added).toHaveLength(0)
  })

  it('ignores a drop while there is no controller', async () => {
    const store = createStore()
    const { result } = setup(null, store)

    result.current.onDrop(dropEvent([imageBlob()]))
    await Promise.resolve()

    expect(store.added).toHaveLength(0)
  })
})

describe('useImageInsert upload', () => {
  it('writes the asset through to the page it belongs to', async () => {
    const store = createStore()
    const { result } = setup(createController(), store)
    const file = imageBlob()

    result.current.onDrop(dropEvent([file]))

    await waitFor(() => {
      expect(persistence.uploadPageAsset).toHaveBeenCalledTimes(1)
    })
    const [publicId, assetId, blob] = persistence.uploadPageAsset.mock.calls[0]
    expect(publicId).toBe('abc')
    expect(blob).toBe(file)
    expect(persistence.assetRepo.putAsset).toHaveBeenCalledWith(assetId, file)
    expect((store.added[0] as ImageElement).assetId).toBe(assetId)
  })

  it('keeps the element and warns when the upload fails', async () => {
    const store = createStore()
    const error = new Error('offline')
    persistence.uploadPageAsset.mockRejectedValue(error)
    const { result } = setup(createController(), store)

    result.current.onDrop(dropEvent([imageBlob()]))

    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith('Asset upload failed', error)
    })
    expect(store.added).toHaveLength(1)
  })

  it('never uploads for a local board', async () => {
    const store = createStore()
    const { result } = setup(createController(), store, { kind: 'local' })

    result.current.onDrop(dropEvent([imageBlob()]))

    await waitFor(() => {
      expect(store.added).toHaveLength(1)
    })
    expect(persistence.uploadPageAsset).not.toHaveBeenCalled()
  })
})

describe('useImageInsert paste', () => {
  it('inserts a pasted image', async () => {
    const store = createStore()
    setup(createController(), store)

    firePaste({}, ['image/png'], imageBlob())

    await waitFor(() => {
      expect(store.added).toHaveLength(1)
    })
  })

  it('leaves a board payload to the scene clipboard', async () => {
    const store = createStore()
    setup(createController(), store)

    firePaste({ [BOARD_CLIPBOARD_MIME]: boardClipboardJson() }, ['image/png'], imageBlob())
    await Promise.resolve()

    expect(store.added).toHaveLength(0)
  })

  it('still inserts when the board payload is unreadable', async () => {
    const store = createStore()
    setup(createController(), store)

    firePaste({ [BOARD_CLIPBOARD_MIME]: 'not json' }, ['image/png'], imageBlob())

    await waitFor(() => {
      expect(store.added).toHaveLength(1)
    })
  })

  it('skips an item that carries no file', async () => {
    const store = createStore()
    setup(createController(), store)

    firePaste({}, ['image/png'], null)
    await Promise.resolve()

    expect(store.added).toHaveLength(0)
  })

  it('ignores a paste of plain text', async () => {
    const store = createStore()
    setup(createController(), store)

    firePaste({}, ['text/plain'], imageBlob())
    await Promise.resolve()

    expect(store.added).toHaveLength(0)
  })

  it('detaches the paste listener on unmount', async () => {
    const store = createStore()
    const { unmount } = setup(createController(), store)

    unmount()
    firePaste({}, ['image/png'], imageBlob())
    await Promise.resolve()

    expect(store.added).toHaveLength(0)
  })
})
