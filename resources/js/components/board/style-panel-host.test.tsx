import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createShape, SceneStore, seedAppState } from '@freedraw/engine'
import type { SceneStore as Store } from '@freedraw/engine'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { BoardExport } from '@/hooks/board/use-export.js'
import { BoardProvider, type BoardContextValue } from './board-context.js'
import { documentColors, MAX_DOCUMENT_COLORS, StylePanelHost } from './style-panel-host.js'
import { RECENT_COLORS_KEY, readRecentColors } from './style-panel/recent-colors.js'

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
    api.addElement(
      createShape({
        id: 'a',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        style: { stroke: '#e03131', fill: '#ffffff', textColor: '#e03131' },
      }),
    )
    api.addElement(
      createShape({
        id: 'b',
        x: 20,
        y: 20,
        width: 10,
        height: 10,
        style: { stroke: '#1971c2', fill: 'transparent', textColor: '#1971c2' },
      }),
    )
  })
  return store
}

function boardValue(store: Store): BoardContextValue {
  return {
    store,
    controller: null,
    boardExport,
    theme: 'light',
    readOnly: false,
    scope: 'edit',
    openImagePicker: vi.fn(),
    sync: null,
  }
}

function renderHost(store: Store) {
  render(
    <TooltipProvider>
      <BoardProvider value={boardValue(store)}>
        <StylePanelHost />
      </BoardProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('documentColors', () => {
  it('collects the distinct colours actually used in the scene', () => {
    expect(documentColors(createStore())).toEqual(['#e03131', '#ffffff', '#1971c2'])
  })

  it('skips transparency and caps the list', () => {
    const store = createStore()
    store.transact((api) => {
      for (let i = 0; i < 40; i += 1) {
        api.addElement(
          createShape({
            id: `x${i}`,
            x: i,
            y: i,
            width: 4,
            height: 4,
            style: { stroke: `#0000${i.toString(16).padStart(2, '0')}`, fill: 'transparent' },
          }),
        )
      }
    })
    const colors = documentColors(store)

    expect(colors).toHaveLength(MAX_DOCUMENT_COLORS)
    expect(colors).not.toContain('transparent')
  })
})

describe('StylePanelHost palette', () => {
  it('offers the document palette to the colour pickers', () => {
    renderHost(createStore())

    expect(screen.getAllByLabelText('In use #e03131').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('In use #1971c2').length).toBeGreaterThan(0)
  })

  it('records a picked colour as recent and persists it', () => {
    const store = createStore()
    renderHost(store)

    fireEvent.click(screen.getAllByLabelText('In use #1971c2')[0]!)

    expect(store.getLastUsedStyle().stroke).toBe('#1971c2')
    expect(screen.getAllByLabelText('Recent #1971c2').length).toBeGreaterThan(0)
    expect(readRecentColors()).toEqual(['#1971c2'])
  })

  it('seeds recents from local storage on mount', () => {
    window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(['#123456']))

    renderHost(createStore())

    expect(screen.getAllByLabelText('Recent #123456').length).toBeGreaterThan(0)
  })
})
