import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SCENE_FILE_VERSION,
  createShape,
  defaultAppState,
  type EditorController,
  type SceneSnapshot,
  type SceneStore,
} from '@freedraw/engine'
import { boardToast } from '@/lib/board-toast'
import { ensureSvgExportFonts } from '@/lib/svg-export-fonts'
import { useExport, type BoardExport } from './use-export.js'

vi.mock('@/lib/board-toast', () => ({
  boardToast: vi.fn(),
}))

vi.mock('@/lib/svg-export-fonts', () => ({
  ensureSvgExportFonts: vi.fn(() => Promise.resolve()),
}))

const toast = vi.mocked(boardToast)
const ensureFonts = vi.mocked(ensureSvgExportFonts)

interface Download {
  filename: string
  blob: Blob | undefined
}

const downloads: Download[] = []
const objectUrls = new Map<string, Blob>()

function createSnapshot(ids: string[]): SceneSnapshot {
  const elements: Record<string, ReturnType<typeof createShape>> = {}
  for (const id of ids) {
    elements[id] = createShape({ id, x: 0, y: 0, width: 10, height: 10 })
  }

  return { order: ids, elements, appState: defaultAppState() } as unknown as SceneSnapshot
}

function createStore(snapshot: SceneSnapshot, selectedIds: string[] = []) {
  return {
    getSnapshot: vi.fn(() => snapshot),
    getUiState: vi.fn(() => ({ selectedIds: new Set(selectedIds) })),
    importScene: vi.fn(),
  }
}

type FakeStore = ReturnType<typeof createStore>

function createController() {
  return {
    exportImage: vi.fn(),
    exportSvg: vi.fn(),
    copyImageToClipboard: vi.fn(),
    zoomToFit: vi.fn(),
  }
}

type FakeController = ReturnType<typeof createController>

function setup(controller: FakeController | null, store: FakeStore): BoardExport {
  const { result } = renderHook(() =>
    useExport(
      controller as unknown as EditorController | null,
      store as unknown as SceneStore,
    ),
  )

  return result.current
}

function fileOf(text: string): File {
  return {
    text: () => Promise.resolve(text),
  } as unknown as File
}

function rejectingFile(error: unknown): File {
  return {
    text: () => Promise.reject(error),
  } as unknown as File
}

beforeEach(() => {
  vi.clearAllMocks()
  downloads.length = 0
  objectUrls.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    const url = `blob:mock/${objectUrls.size + 1}`
    objectUrls.set(url, blob as Blob)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push({ filename: this.download, blob: objectUrls.get(this.href) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useExport image export', () => {
  it('downloads the blob and reports the format on success', async () => {
    const controller = createController()
    const blob = new Blob(['png-bytes'], { type: 'image/png' })
    controller.exportImage.mockResolvedValue({ ok: true, blob })

    await setup(controller, createStore(createSnapshot([]))).exportImage('png', true, false, {
      scale: 3,
      selectionOnly: true,
    })

    expect(controller.exportImage).toHaveBeenCalledWith({
      format: 'png',
      transparent: true,
      dark: false,
      scale: 3,
      selectionOnly: true,
    })
    expect(downloads).toEqual([{ filename: 'freedraw.png', blob }])
    expect(toast).toHaveBeenCalledWith('Exported as PNG')
  })

  it('uses the jpg extension and label for jpg exports', async () => {
    const controller = createController()
    controller.exportImage.mockResolvedValue({
      ok: true,
      blob: new Blob(['jpg'], { type: 'image/jpeg' }),
    })

    await setup(controller, createStore(createSnapshot([]))).exportImage('jpg', false, true)

    expect(downloads[0].filename).toBe('freedraw.jpg')
    expect(toast).toHaveBeenCalledWith('Exported as JPG')
  })

  it('does nothing at all without a controller', async () => {
    await setup(null, createStore(createSnapshot([]))).exportImage('png', false, false)

    expect(downloads).toEqual([])
    expect(toast).not.toHaveBeenCalled()
  })

  it('reports an empty scene without downloading', async () => {
    const controller = createController()
    controller.exportImage.mockResolvedValue({ ok: false, reason: 'empty' })

    await setup(controller, createStore(createSnapshot([]))).exportImage('png', false, false)

    expect(toast).toHaveBeenCalledWith('Nothing to export', 'error')
    expect(downloads).toEqual([])
  })

  it('reports an unsupported browser', async () => {
    const controller = createController()
    controller.exportImage.mockResolvedValue({ ok: false, reason: 'unsupported' })

    await setup(controller, createStore(createSnapshot([]))).exportImage('png', false, false)

    expect(toast).toHaveBeenCalledWith('Export is not supported in this browser', 'error')
    expect(downloads).toEqual([])
  })

  it('suggests the next whole scale when the board is too large', async () => {
    const controller = createController()
    controller.exportImage.mockResolvedValue({
      ok: false,
      reason: 'too-large',
      size: { width: 40000, height: 40000, scale: 4, maxScale: 2.7 },
    })

    await setup(controller, createStore(createSnapshot([]))).exportImage('png', false, false)

    expect(toast).toHaveBeenCalledWith('Board too large at 4x — try 2x or lower', 'error')
  })

  it('suggests exporting a selection when no whole scale fits', async () => {
    const controller = createController()
    controller.exportImage.mockResolvedValue({
      ok: false,
      reason: 'too-large',
      size: { width: 90000, height: 90000, scale: 2, maxScale: 0.4 },
    })

    await setup(controller, createStore(createSnapshot([]))).exportImage('png', false, false)

    expect(toast).toHaveBeenCalledWith(
      'Board too large to export — try exporting a selection',
      'error',
    )
  })

  it('swallows a rejected export and reports the failure', async () => {
    const controller = createController()
    const error = new Error('canvas exploded')
    controller.exportImage.mockRejectedValue(error)

    await setup(controller, createStore(createSnapshot([]))).exportImage('png', false, false)

    expect(console.error).toHaveBeenCalledWith('Export failed', error)
    expect(toast).toHaveBeenCalledWith('Export failed', 'error')
    expect(downloads).toEqual([])
  })
})

describe('useExport svg export', () => {
  it('downloads an svg blob on success', async () => {
    const controller = createController()
    controller.exportSvg.mockResolvedValue({ ok: true, svg: '<svg></svg>' })

    await setup(controller, createStore(createSnapshot([]))).exportSvg(true, { scale: 2 })

    expect(controller.exportSvg).toHaveBeenCalledWith({
      dark: true,
      scale: 2,
      selectionOnly: undefined,
    })
    expect(downloads[0].filename).toBe('freedraw.svg')
    expect(downloads[0].blob?.type).toBe('image/svg+xml')
    expect(await downloads[0].blob?.text()).toBe('<svg></svg>')
    expect(toast).toHaveBeenCalledWith('Exported as SVG')
  })

  it('embeds the export font faces before rendering the svg', async () => {
    const controller = createController()
    const order: string[] = []
    ensureFonts.mockImplementation(() => {
      order.push('fonts')
      return Promise.resolve()
    })
    controller.exportSvg.mockImplementation(() => {
      order.push('svg')
      return Promise.resolve({ ok: true, svg: '<svg></svg>' })
    })

    await setup(controller, createStore(createSnapshot([]))).exportSvg(false)

    expect(order).toEqual(['fonts', 'svg'])
  })

  it('leaves image exports untouched by the font embed', async () => {
    const controller = createController()
    controller.exportImage.mockResolvedValue({
      ok: true,
      blob: new Blob(['png'], { type: 'image/png' }),
    })

    await setup(controller, createStore(createSnapshot([]))).exportImage('png', false, false)

    expect(ensureFonts).not.toHaveBeenCalled()
  })

  it('does nothing at all without a controller', async () => {
    await setup(null, createStore(createSnapshot([]))).exportSvg(false)

    expect(downloads).toEqual([])
    expect(ensureFonts).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('reports a failed svg render without downloading', async () => {
    const controller = createController()
    controller.exportSvg.mockResolvedValue({ ok: false, reason: 'empty' })

    await setup(controller, createStore(createSnapshot([]))).exportSvg(false)

    expect(toast).toHaveBeenCalledWith('Nothing to export', 'error')
    expect(downloads).toEqual([])
  })

  it('swallows a rejected svg export', async () => {
    const controller = createController()
    controller.exportSvg.mockRejectedValue(new Error('nope'))

    await setup(controller, createStore(createSnapshot([]))).exportSvg(false)

    expect(toast).toHaveBeenCalledWith('Export failed', 'error')
    expect(downloads).toEqual([])
  })
})

describe('useExport clipboard copy', () => {
  it('confirms the copy on success', async () => {
    const controller = createController()
    controller.copyImageToClipboard.mockResolvedValue({ ok: true, blob: new Blob(['x']) })

    await setup(controller, createStore(createSnapshot([]))).copyImage({ selectionOnly: true })

    expect(controller.copyImageToClipboard).toHaveBeenCalledWith({
      scale: undefined,
      selectionOnly: true,
    })
    expect(toast).toHaveBeenCalledWith('Copied to clipboard')
    expect(downloads).toEqual([])
  })

  it('does nothing at all without a controller', async () => {
    await setup(null, createStore(createSnapshot([]))).copyImage()

    expect(toast).not.toHaveBeenCalled()
  })

  it('reports a browser without clipboard image support', async () => {
    const controller = createController()
    controller.copyImageToClipboard.mockResolvedValue({
      ok: false,
      reason: 'clipboard-unsupported',
    })

    await setup(controller, createStore(createSnapshot([]))).copyImage()

    expect(toast).toHaveBeenCalledWith('Clipboard not supported', 'error')
  })

  it('reuses the export message when the render itself failed', async () => {
    const controller = createController()
    controller.copyImageToClipboard.mockResolvedValue({
      ok: false,
      reason: 'too-large',
      size: { width: 40000, height: 40000, scale: 3, maxScale: 1.5 },
    })

    await setup(controller, createStore(createSnapshot([]))).copyImage()

    expect(toast).toHaveBeenCalledWith('Board too large at 3x — try 1x or lower', 'error')
  })

  it('swallows a rejected clipboard write', async () => {
    const controller = createController()
    const error = new Error('denied')
    controller.copyImageToClipboard.mockRejectedValue(error)

    await setup(controller, createStore(createSnapshot([]))).copyImage()

    expect(console.error).toHaveBeenCalledWith('Clipboard copy failed', error)
    expect(toast).toHaveBeenCalledWith('Copy failed', 'error')
  })
})

describe('useExport scene export', () => {
  it('downloads the whole scene as a freedraw file', async () => {
    const store = createStore(createSnapshot(['a', 'b']))

    setup(null, store).exportScene()

    expect(downloads[0].filename).toBe('freedraw.freedraw.json')
    const parsed = JSON.parse((await downloads[0].blob?.text()) ?? '')
    expect(parsed.type).toBe('freedraw')
    expect(parsed.order).toEqual(['a', 'b'])
    expect(toast).toHaveBeenCalledWith('Exported as JSON')
  })

  it('exports only the selection when asked', async () => {
    const store = createStore(createSnapshot(['a', 'b']), ['b'])

    setup(null, store).exportScene({ selectionOnly: true })

    const parsed = JSON.parse((await downloads[0].blob?.text()) ?? '')
    expect(parsed.order).toEqual(['b'])
    expect(Object.keys(parsed.elements)).toEqual(['b'])
  })

  it('reports an empty scene without downloading', () => {
    setup(null, createStore(createSnapshot([]))).exportScene()

    expect(toast).toHaveBeenCalledWith('Nothing to export', 'error')
    expect(downloads).toEqual([])
  })

  it('reports an empty selection without downloading', () => {
    setup(null, createStore(createSnapshot(['a']), [])).exportScene({ selectionOnly: true })

    expect(toast).toHaveBeenCalledWith('Nothing to export', 'error')
    expect(downloads).toEqual([])
  })
})

describe('useExport scene import', () => {
  function sceneJson(ids: string[], version = SCENE_FILE_VERSION): string {
    const snapshot = createSnapshot(ids)
    return JSON.stringify({
      type: 'freedraw',
      version,
      elements: snapshot.elements,
      order: snapshot.order,
      appState: snapshot.appState,
    })
  }

  it('imports a valid scene, refits the view and counts the elements', async () => {
    const controller = createController()
    const store = createStore(createSnapshot([]))

    await setup(controller, store).importScene(fileOf(sceneJson(['a', 'b'])))

    expect(store.importScene).toHaveBeenCalledTimes(1)
    expect(store.importScene.mock.calls[0][0].order).toEqual(['a', 'b'])
    expect(controller.zoomToFit).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Imported 2 elements')
  })

  it('uses the singular form for a single element', async () => {
    const store = createStore(createSnapshot([]))

    await setup(null, store).importScene(fileOf(sceneJson(['only'])))

    expect(store.importScene).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Imported 1 element')
  })

  it('rejects a file that is not a freedraw scene', async () => {
    const store = createStore(createSnapshot([]))

    await setup(null, store).importScene(fileOf('{"hello":"world"}'))

    expect(store.importScene).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Not a FreeDraw file', 'error')
  })

  it('rejects unparseable text', async () => {
    const store = createStore(createSnapshot([]))

    await setup(null, store).importScene(fileOf('not json at all'))

    expect(store.importScene).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Not a FreeDraw file', 'error')
  })

  it('refuses a scene written by a newer schema version', async () => {
    const store = createStore(createSnapshot([]))

    await setup(null, store).importScene(fileOf(sceneJson(['a'], SCENE_FILE_VERSION + 1)))

    expect(store.importScene).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(
      'This file was made with a newer version of FreeDraw',
      'error',
    )
  })

  it('accepts a scene written by an older schema version', async () => {
    const store = createStore(createSnapshot([]))

    await setup(null, store).importScene(fileOf(sceneJson(['a'], SCENE_FILE_VERSION - 1)))

    expect(store.importScene).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Imported 1 element')
  })

  it('swallows an unreadable file', async () => {
    const store = createStore(createSnapshot([]))
    const error = new Error('unreadable')

    await setup(null, store).importScene(rejectingFile(error))

    expect(console.error).toHaveBeenCalledWith('Import failed', error)
    expect(store.importScene).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Import failed', 'error')
  })
})
