import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createShape, type EditorController, type SceneStore } from '@freedraw/engine'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { BoardExport } from '@/hooks/board/use-export.js'
import { BoardProvider, type BoardContextValue } from '../board-context.js'
import { SCENE_IMPORT_EVENT } from '../board-actions.js'
import { ExportMenu } from './export-menu.js'

interface SceneState {
  sizes?: number[]
  selectedIds?: string[]
}

function createStore({ sizes = [10], selectedIds = [] }: SceneState = {}) {
  const elements: Record<string, ReturnType<typeof createShape>> = {}
  const order: string[] = []
  sizes.forEach((size, index) => {
    const id = `e${index}`
    order.push(id)
    elements[id] = createShape({ id, x: 0, y: 0, width: size, height: size })
  })

  const ui = { selectedIds: new Set(selectedIds) }
  const snapshot = { order, elements, appState: {} }

  const store = {
    getUiState: () => ui,
    getSnapshot: () => snapshot,
    select: <T,>(selector: (source: unknown) => T) => {
      const value = selector(store)
      return {
        subscribe: () => () => {},
        getSnapshot: () => value,
      }
    },
  }

  return store
}

type FakeStore = ReturnType<typeof createStore>

function createBoardExport() {
  return {
    exportImage: vi.fn(),
    exportSvg: vi.fn(),
    copyImage: vi.fn(),
    exportScene: vi.fn(),
    importScene: vi.fn(),
  }
}

type FakeExport = ReturnType<typeof createBoardExport>

interface SetupOptions {
  store?: FakeStore
  boardExport?: FakeExport
  readOnly?: boolean
  theme?: 'light' | 'dark'
}

function renderMenu({
  store = createStore(),
  boardExport = createBoardExport(),
  readOnly = false,
  theme = 'light',
}: SetupOptions = {}) {
  const value: BoardContextValue = {
    store: store as unknown as SceneStore,
    controller: null as unknown as EditorController | null,
    boardExport: boardExport as unknown as BoardExport,
    theme,
    readOnly,
    scope: readOnly ? 'view' : 'edit',
    openImagePicker: vi.fn(),
    sync: null,
  }

  render(
    createElement(TooltipProvider, {
      children: createElement(BoardProvider, {
        value,
        children: createElement(ExportMenu) as ReactNode,
      }),
    }),
  )

  return { store, boardExport }
}

async function openMenu(options: SetupOptions = {}) {
  const handles = renderMenu(options)
  fireEvent.click(screen.getByLabelText('Export'))
  await screen.findByText('Export PNG')
  return handles
}

function item(label: string): HTMLButtonElement {
  const button = screen.getByText(label).closest('button')
  if (!button) throw new Error(`Missing menu item ${label}`)
  return button as HTMLButtonElement
}

function checkbox(label: string): HTMLInputElement {
  const input = screen.getByText(label).closest('label')?.querySelector('input')
  if (!input) throw new Error(`Missing checkbox ${label}`)
  return input
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('ExportMenu entries', () => {
  it('lists every export entry once opened', async () => {
    await openMenu()

    for (const label of [
      'Export PNG',
      'Export JPG',
      'Export SVG',
      'Export JSON',
      'Copy to clipboard',
      'Import JSON',
    ]) {
      expect(item(label).disabled).toBe(false)
    }
  })

  it('keeps the entries closed until the trigger is clicked', () => {
    renderMenu()

    expect(screen.queryByText('Export PNG')).toBeNull()
  })

  it('disables the export entries when the board has nothing on it', async () => {
    await openMenu({ store: createStore({ sizes: [] }) })

    expect(item('Export PNG').disabled).toBe(true)
    expect(item('Export JPG').disabled).toBe(true)
    expect(item('Export SVG').disabled).toBe(true)
    expect(item('Export JSON').disabled).toBe(true)
    expect(item('Copy to clipboard').disabled).toBe(true)
    expect(item('Import JSON').disabled).toBe(false)
  })

  it('hides the import entry on a read-only board', async () => {
    await openMenu({ readOnly: true })

    expect(item('Export PNG').disabled).toBe(false)
    expect(screen.queryByText('Import JSON')).toBeNull()
  })

  it('only disables the trigger for a read-only empty board', () => {
    renderMenu({ store: createStore({ sizes: [] }), readOnly: true })
    expect((screen.getByLabelText('Export') as HTMLButtonElement).disabled).toBe(true)

    cleanup()

    renderMenu({ store: createStore({ sizes: [] }) })
    expect((screen.getByLabelText('Export') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('ExportMenu actions', () => {
  it('exports a png with the current options and closes', async () => {
    const { boardExport } = await openMenu()

    fireEvent.click(item('Export PNG'))

    expect(boardExport.exportImage).toHaveBeenCalledWith('png', false, false, {
      scale: 2,
      selectionOnly: false,
    })
    await waitFor(() => {
      expect(screen.queryByText('Export PNG')).toBeNull()
    })
  })

  it('passes the transparent flag to png but never to jpg', async () => {
    const { boardExport } = await openMenu()

    fireEvent.click(checkbox('Transparent (PNG)'))
    fireEvent.click(item('Export PNG'))
    expect(boardExport.exportImage).toHaveBeenCalledWith('png', true, false, expect.anything())

    fireEvent.click(screen.getByLabelText('Export'))
    await screen.findByText('Export JPG')
    fireEvent.click(item('Export JPG'))
    expect(boardExport.exportImage).toHaveBeenLastCalledWith('jpg', false, false, expect.anything())
  })

  it('sends the chosen theme to svg and clipboard exports', async () => {
    const { boardExport } = await openMenu()

    fireEvent.click(screen.getByLabelText('Dark'))
    fireEvent.click(item('Export SVG'))
    expect(boardExport.exportSvg).toHaveBeenCalledWith(true, { scale: 2, selectionOnly: false })

    fireEvent.click(screen.getByLabelText('Export'))
    await screen.findByText('Copy to clipboard')
    fireEvent.click(item('Copy to clipboard'))
    expect(boardExport.copyImage).toHaveBeenCalledWith({ scale: 2, selectionOnly: false })
  })

  it('starts on the board theme', async () => {
    const { boardExport } = await openMenu({ theme: 'dark' })

    fireEvent.click(item('Export SVG'))

    expect(boardExport.exportSvg).toHaveBeenCalledWith(true, expect.anything())
  })

  it('asks for the scene file when exporting json', async () => {
    const { boardExport } = await openMenu()

    fireEvent.click(item('Export JSON'))

    expect(boardExport.exportScene).toHaveBeenCalledWith({ scale: 2, selectionOnly: false })
  })

  it('raises the import event and closes for import json', async () => {
    const listener = vi.fn()
    window.addEventListener(SCENE_IMPORT_EVENT, listener)
    await openMenu()

    fireEvent.click(item('Import JSON'))
    window.removeEventListener(SCENE_IMPORT_EVENT, listener)

    expect(listener).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('Import JSON')).toBeNull()
    })
  })
})

describe('ExportMenu selection scope', () => {
  it('locks the selection toggle while nothing is selected', async () => {
    await openMenu()

    expect(checkbox('Selection only').disabled).toBe(true)
    expect(checkbox('Selection only').checked).toBe(false)
  })

  it('scopes the export to the selection once toggled', async () => {
    const { boardExport } = await openMenu({
      store: createStore({ sizes: [10, 20], selectedIds: ['e1'] }),
    })

    const toggle = checkbox('Selection only')
    expect(toggle.disabled).toBe(false)
    fireEvent.click(toggle)
    fireEvent.click(item('Export JSON'))

    expect(boardExport.exportScene).toHaveBeenCalledWith({ scale: 2, selectionOnly: true })
  })
})

describe('ExportMenu scale limits', () => {
  it('offers every scale for a small board', async () => {
    await openMenu()

    expect(screen.getByLabelText('2x').getAttribute('aria-disabled')).toBeNull()
    expect(screen.queryByLabelText('3x (unavailable)')).toBeNull()
    expect(screen.queryByText(/too large/)).toBeNull()
  })

  it('clamps the scale and explains why when the board is huge', async () => {
    const { boardExport } = await openMenu({ store: createStore({ sizes: [10000] }) })

    expect(screen.getByText('Board too large above 1x')).not.toBeNull()
    expect(screen.getByLabelText('2x (unavailable)').getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByLabelText('3x (unavailable)')).not.toBeNull()

    fireEvent.click(item('Export PNG'))

    expect(boardExport.exportImage).toHaveBeenCalledWith('png', false, false, {
      scale: 1,
      selectionOnly: false,
    })
  })

  it('ignores a disabled scale click and keeps the clamped value', async () => {
    const { boardExport } = await openMenu({ store: createStore({ sizes: [10000] }) })

    fireEvent.click(screen.getByLabelText('3x (unavailable)'))
    fireEvent.click(item('Export PNG'))

    expect(boardExport.exportImage).toHaveBeenCalledWith('png', false, false, {
      scale: 1,
      selectionOnly: false,
    })
  })

  it('measures the selection instead of the board when scoped', async () => {
    await openMenu({ store: createStore({ sizes: [10000, 10], selectedIds: ['e1'] }) })

    expect(screen.getByText('Board too large above 1x')).not.toBeNull()

    fireEvent.click(checkbox('Selection only'))

    expect(screen.queryByText(/too large/)).toBeNull()
    expect(screen.queryByLabelText('3x (unavailable)')).toBeNull()
  })
})
