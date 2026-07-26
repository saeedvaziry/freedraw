import { fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createShape, SceneStore, seedAppState } from '@freedraw/engine'
import type { SceneStore as Store } from '@freedraw/engine'
import type { BoardExport } from '@/hooks/board/use-export.js'
import { BoardProvider, type BoardContextValue } from '../board-context.js'
import { SlidesPanelHost } from './slides-panel-host.js'

const boardExport = {
  exportImage: vi.fn(),
  exportSvg: vi.fn(),
  copyImage: vi.fn(),
  exportScene: vi.fn(),
  importScene: vi.fn(),
} as unknown as BoardExport

function createStore(): Store {
  const doc = new Y.Doc()
  seedAppState(doc)
  const store = new SceneStore(doc)
  store.transact((api) => {
    api.addElement(createShape({ id: 'a', x: 10, y: 20, width: 30, height: 40 }))
    api.addElement(createShape({ id: 'b', x: 60, y: 80, width: 20, height: 20 }))
  })
  return store
}

function boardValue(store: Store, readOnly: boolean): BoardContextValue {
  return {
    store,
    controller: null,
    boardExport,
    theme: 'light',
    readOnly,
    scope: readOnly ? 'view' : 'edit',
    openImagePicker: vi.fn(),
    sync: null,
  }
}

function renderPanel(store: Store, readOnly = false) {
  const onClose = vi.fn()
  render(
    createElement(BoardProvider, {
      value: boardValue(store, readOnly),
      children: createElement(SlidesPanelHost, { onClose }) as ReactNode,
    }),
  )
  return onClose
}

function names(store: Store): string[] {
  return [...store.getSlides()].sort((a, b) => a.order - b.order).map((slide) => slide.name)
}

describe('SlidesPanel authoring', () => {
  it('turns the current selection into a slide framed on its bounds', () => {
    const store = createStore()
    store.setUiState({ selectedIds: new Set(['a', 'b']) })

    renderPanel(store)
    fireEvent.click(screen.getByText('Add slide from selection'))

    expect(store.getSlides()).toHaveLength(1)
    expect(store.getSlides()[0]!.rect).toEqual({ x: 10, y: 20, width: 70, height: 80 })
    expect(screen.getByText('Slide 1')).not.toBeNull()
  })

  it('blocks creating a slide while nothing is selected', () => {
    const store = createStore()

    renderPanel(store)

    const button = screen.getByText('Add slide from selection').closest('button')
    expect(button?.hasAttribute('disabled')).toBe(true)
    expect(store.getSlides()).toHaveLength(0)
  })

  it('renames a slide from the row editor', () => {
    const store = createStore()
    store.addSlide({ x: 0, y: 0, width: 100, height: 100 })

    renderPanel(store)
    fireEvent.click(screen.getByLabelText('Rename Slide 1'))
    const input = screen.getByLabelText('Rename Slide 1')
    fireEvent.change(input, { target: { value: 'Intro' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(names(store)).toEqual(['Intro'])
    expect(screen.getByText('Intro')).not.toBeNull()
  })

  it('keeps the old name when the rename is cancelled', () => {
    const store = createStore()
    store.addSlide({ x: 0, y: 0, width: 100, height: 100 })

    renderPanel(store)
    fireEvent.click(screen.getByLabelText('Rename Slide 1'))
    const input = screen.getByLabelText('Rename Slide 1')
    fireEvent.change(input, { target: { value: 'Discarded' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(names(store)).toEqual(['Slide 1'])
  })

  it('deletes a slide and renumbers the ones left', () => {
    const store = createStore()
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })

    renderPanel(store)
    fireEvent.click(screen.getByLabelText('Delete Slide 1'))

    expect(names(store)).toEqual(['Slide 2'])
    expect(store.getSlides()[0]!.order).toBe(0)
    expect(screen.queryByText('Slide 1')).toBeNull()
  })

  it('reorders slides with the row move controls', () => {
    const store = createStore()
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })

    renderPanel(store)
    fireEvent.click(screen.getByLabelText('Move Slide 1 down'))

    expect(names(store)).toEqual(['Slide 2', 'Slide 1', 'Slide 3'])

    fireEvent.click(screen.getByLabelText('Move Slide 3 up'))

    expect(names(store)).toEqual(['Slide 2', 'Slide 3', 'Slide 1'])
  })

  it('pins the move controls at the ends of the list', () => {
    const store = createStore()
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })

    renderPanel(store)

    expect(screen.getByLabelText('Move Slide 1 up').hasAttribute('disabled')).toBe(true)
    expect(screen.getByLabelText('Move Slide 2 down').hasAttribute('disabled')).toBe(true)
    expect(screen.getByLabelText('Move Slide 1 down').hasAttribute('disabled')).toBe(false)
  })

  it('renders nothing on a read-only board', () => {
    const store = createStore()
    store.addSlide({ x: 0, y: 0, width: 10, height: 10 })

    renderPanel(store, true)

    expect(screen.queryByText('Slides')).toBeNull()
  })
})
