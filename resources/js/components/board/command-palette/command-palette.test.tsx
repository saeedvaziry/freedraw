import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SceneStore, createArrow, createShape } from '@freedraw/engine'
import type { Element } from '@freedraw/engine'
import type { BoardActionContext } from '@/components/board/board-actions.js'
import type { BoardExport } from '@/hooks/board/use-export.js'
import { CommandPalette } from './command-palette.js'

const boardExport = {
  exportImage: vi.fn(),
  exportSvg: vi.fn(),
  copyImage: vi.fn(),
  exportScene: vi.fn(),
  importScene: vi.fn(),
} as unknown as BoardExport

function connectedGraph(): Element[] {
  return [
    createShape({ id: 'n1', type: 'rect', x: 320, y: 640, width: 120, height: 80 }),
    createShape({ id: 'n2', type: 'rect', x: 40, y: 40, width: 120, height: 80 }),
    createArrow({
      id: 'e1',
      points: [
        { x: 380, y: 640 },
        { x: 100, y: 120 },
      ],
      start: { elementId: 'n1', anchor: { nx: 0.5, ny: 0 }, gap: 0, side: 'top' },
      end: { elementId: 'n2', anchor: { nx: 0.5, ny: 1 }, gap: 0, side: 'bottom' },
    }),
  ]
}

function storeWith(elements: Element[]): SceneStore {
  const store = new SceneStore()
  store.transact((api) => {
    for (const element of elements) api.addElement(element)
  })
  store.stopCapturing()
  return store
}

function contextFor(store: SceneStore, readOnly = false): BoardActionContext {
  return { store, controller: null, boardExport, theme: 'light', readOnly, openImagePicker: vi.fn() }
}

function open(store: SceneStore, readOnly = false): { onOpenChange: ReturnType<typeof vi.fn> } {
  const onOpenChange = vi.fn()
  render(
    createElement(CommandPalette, {
      open: true,
      onOpenChange,
      context: contextFor(store, readOnly),
    }),
  )
  return { onOpenChange }
}

function search(query: string): void {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: query } })
}

function positions(store: SceneStore, ids: string[]): Record<string, { x: number; y: number }> {
  const snapshot = store.getSnapshot()
  const result: Record<string, { x: number; y: number }> = {}
  for (const id of ids) {
    const element = snapshot.elements[id]!
    result[id] = { x: element.x, y: element.y }
  }
  return result
}

describe('CommandPalette tidy command', () => {
  it('lists Tidy diagram when the scene holds a connected graph', () => {
    open(storeWith(connectedGraph()))

    expect(screen.queryByText('Tidy diagram')).not.toBeNull()
  })

  it('finds it by a fuzzy query', () => {
    open(storeWith(connectedGraph()))
    search('tidy')

    expect(screen.queryByText(/Tidy/)).not.toBeNull()
  })

  it('hides it when nothing in the scene is connected', () => {
    open(storeWith([createShape({ id: 'n1', type: 'rect', x: 0, y: 0, width: 120, height: 80 })]))

    expect(screen.queryByText('Tidy diagram')).toBeNull()
  })

  it('hides it on a read-only board', () => {
    open(storeWith(connectedGraph()), true)

    expect(screen.queryByText('Tidy diagram')).toBeNull()
  })

  it('hides it when the selection only holds free-floating elements', () => {
    const store = storeWith([
      ...connectedGraph(),
      createShape({ id: 'loner', type: 'rect', x: 4000, y: 0, width: 120, height: 80 }),
    ])
    store.setUiState({ selectedIds: new Set(['loner']) })
    open(store)

    expect(screen.queryByText('Tidy diagram')).toBeNull()
  })

  it('reflows the graph and closes the palette when picked', () => {
    const store = storeWith(connectedGraph())
    const before = positions(store, ['n1', 'n2'])
    const { onOpenChange } = open(store)

    fireEvent.click(screen.getByText('Tidy diagram'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(positions(store, ['n1', 'n2'])).not.toEqual(before)
  })

  it('leaves free-floating elements where they are', () => {
    const store = storeWith([
      ...connectedGraph(),
      createShape({ id: 'loner', type: 'rect', x: 4000, y: 900, width: 120, height: 80 }),
    ])
    open(store)

    fireEvent.click(screen.getByText('Tidy diagram'))

    expect(positions(store, ['loner'])).toEqual({ loner: { x: 4000, y: 900 } })
  })
})
