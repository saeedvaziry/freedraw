import { act, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultStyle } from '@freedraw/engine'
import type {
  EditListener,
  EditorController,
  EditRequest,
  FlowContext,
  SpawnDirection,
} from '@freedraw/engine'
import { FlowHud } from './flow-hud.js'
import { TextEditorOverlay } from './text-editor-overlay.js'

function request(overrides: Partial<EditRequest> = {}): EditRequest {
  return {
    elementId: 'node-1',
    target: 'label',
    labelKind: 'shape',
    text: '',
    world: { x: 100, y: 100, width: 120, height: 60 },
    style: defaultStyle,
    align: 'center',
    verticalAlign: 'middle',
    ...overrides,
  }
}

interface FakeOptions {
  readOnly?: boolean
  flow?: FlowContext | null
  center?: { x: number; y: number }
}

function fakeController({ readOnly = false, flow = null, center = { x: 0, y: 0 } }: FakeOptions = {}) {
  const listeners = new Set<EditListener>()
  let currentFlow = flow
  const setFlowDirection = vi.fn((direction: SpawnDirection) => {
    if (currentFlow) currentFlow = { ...currentFlow, direction }
  })

  const controller = {
    zoom: 1,
    isDark: false,
    isReadOnly: readOnly,
    viewportSize: { width: 800, height: 600 },
    activeEdit: null,
    get flowContext() {
      return currentFlow
    },
    setFlowDirection,
    spawnChildAndEdit: vi.fn(),
    spawnSiblingAndEdit: vi.fn(),
    deleteFlowPlaceholder: vi.fn(),
    commitText: vi.fn(),
    cancelEdit: vi.fn(),
    resizeTextWhileEditing: vi.fn(),
    resizeShapeForLabel: vi.fn(),
    worldToScreen: (point: { x: number; y: number }) => point,
    elementCenterScreen: () => center,
    measureTextSize: () => ({ width: 40, height: 20 }),
    subscribeEdit(listener: EditListener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }

  return {
    controller: controller as unknown as EditorController,
    commitText: controller.commitText,
    setFlowDirection,
    spawnChildAndEdit: controller.spawnChildAndEdit,
    emit(next: EditRequest | null) {
      act(() => listeners.forEach((listener) => listener(next)))
    },
  }
}

function hud(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-test="flow-hud"]')
}

function activeDirection(): string | null {
  const marks = document.querySelectorAll<HTMLElement>('[data-test^="flow-hud-direction-"]')
  for (const mark of marks) {
    if (mark.dataset.active === 'true') {
      return mark.dataset.test?.replace('flow-hud-direction-', '') ?? null
    }
  }
  return null
}

function textarea(): HTMLTextAreaElement {
  return document.querySelector('textarea') as HTMLTextAreaElement
}

const originalMatchMedia = window.matchMedia
const originalVisualViewport = window.visualViewport

function setCoarsePointer(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () =>
      ({
        matches,
        media: '(pointer: coarse)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  })
}

function setVisualViewport(rect: { left: number; top: number; width: number; height: number }): void {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      offsetLeft: rect.left,
      offsetTop: rect.top,
      width: rect.width,
      height: rect.height,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as VisualViewport,
  })
}

beforeEach(() => {
  setCoarsePointer(false)
  setVisualViewport({ left: 0, top: 0, width: 800, height: 600 })
})

afterAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  })
})

describe('FlowHud', () => {
  it('marks only the current spawn direction as active', () => {
    render(createElement(FlowHud, { direction: 'down', x: 40, y: 80 }))

    expect(activeDirection()).toBe('down')
    expect(document.querySelectorAll('[data-test^="flow-hud-direction-"]')).toHaveLength(4)
  })

  it('never takes pointer events or focus away from the canvas', () => {
    render(createElement(FlowHud, { direction: 'right', x: 0, y: 0 }))

    const panel = hud()
    expect(panel?.className).toContain('pointer-events-none')
    expect(panel?.querySelectorAll('button, input, textarea, [tabindex]')).toHaveLength(0)
  })

  it('spells out the keys that drive the flow', () => {
    render(createElement(FlowHud, { direction: 'right', x: 0, y: 0 }))

    const keys = [...document.querySelectorAll('kbd')].map((key) => key.textContent)
    expect(keys).toEqual(['Tab', 'Enter', 'Shift + Enter', 'Alt', 'Esc'])
  })
})

describe('TextEditorOverlay flow hint', () => {
  it('stays hidden while nothing is being edited', () => {
    const { controller } = fakeController()

    render(createElement(TextEditorOverlay, { controller }))

    expect(hud()).toBeNull()
  })

  it('appears below the node whose label is being edited', () => {
    const { controller, emit } = fakeController()

    render(createElement(TextEditorOverlay, { controller }))
    emit(request())

    const panel = hud()
    expect(panel).not.toBeNull()
    expect(panel?.style.left).toBe('182px')
    expect(panel?.style.top).toBe('170px')
  })

  it('stays hidden while a standalone text element is being edited', () => {
    const { controller, emit } = fakeController()

    render(createElement(TextEditorOverlay, { controller }))
    emit(request({ target: 'text', labelKind: undefined }))

    expect(hud()).toBeNull()
  })

  it('stays hidden for arrow labels, which cannot spawn children', () => {
    const { controller, emit } = fakeController()

    render(createElement(TextEditorOverlay, { controller }))
    emit(request({ labelKind: 'arrow' }))

    expect(hud()).toBeNull()
  })

  it('stays hidden on a read-only or presenting board', () => {
    const { controller, emit } = fakeController({ readOnly: true })

    render(createElement(TextEditorOverlay, { controller }))
    emit(request())

    expect(hud()).toBeNull()
  })

  it('adopts the direction of the flow that opened the editor', () => {
    const { controller, emit } = fakeController({
      flow: { editingId: 'node-1', parentId: 'node-0', direction: 'up' },
    })

    render(createElement(TextEditorOverlay, { controller }))
    emit(request())

    expect(activeDirection()).toBe('up')
  })

  it('falls back to the default direction when the flow belongs to another node', () => {
    const { controller, emit } = fakeController({
      flow: { editingId: 'other', parentId: 'node-0', direction: 'up' },
    })

    render(createElement(TextEditorOverlay, { controller }))
    emit(request())

    expect(activeDirection()).toBe('right')
  })

  it('reflects the direction picked with Alt+Arrow and spawns that way on Tab', () => {
    const { controller, emit, setFlowDirection, spawnChildAndEdit } = fakeController()

    render(createElement(TextEditorOverlay, { controller }))
    emit(request())

    expect(activeDirection()).toBe('right')

    fireEvent.keyDown(textarea(), { key: 'ArrowDown', altKey: true })

    expect(activeDirection()).toBe('down')
    expect(setFlowDirection).toHaveBeenCalledWith('down')

    fireEvent.keyDown(textarea(), { key: 'Tab' })

    expect(spawnChildAndEdit).toHaveBeenCalledWith('node-1', 'down')
  })

  it('disappears once the edit session ends', () => {
    const { controller, emit } = fakeController()

    render(createElement(TextEditorOverlay, { controller }))
    emit(request())
    expect(hud()).not.toBeNull()

    emit(null)

    expect(hud()).toBeNull()
  })
})

describe('TextEditorOverlay mobile editing', () => {
  it('requires the explicit Done action instead of committing on blur', () => {
    setCoarsePointer(true)
    const { controller, commitText, emit } = fakeController()

    render(createElement(TextEditorOverlay, { controller }))
    emit(request({ target: 'text', labelKind: undefined, text: 'Mobile' }))

    const done = document.querySelector<HTMLButtonElement>('[data-test="text-editor-done"]')
    expect(done?.textContent).toBe('Done')

    fireEvent.blur(textarea())
    expect(commitText).not.toHaveBeenCalled()

    fireEvent.pointerDown(done!)
    fireEvent.click(done!)
    expect(commitText).toHaveBeenCalledWith('node-1', 'text', 'Mobile')
  })

  it('keeps the editor and Done action above the visual viewport keyboard edge', () => {
    setCoarsePointer(true)
    setVisualViewport({ left: 0, top: 0, width: 320, height: 300 })
    const { controller, emit } = fakeController({ center: { x: 160, y: 280 } })

    render(createElement(TextEditorOverlay, { controller }))
    emit(request({ target: 'text', labelKind: undefined, text: 'Mobile' }))

    expect(textarea().style.top).toBe('226px')
    const done = document.querySelector<HTMLButtonElement>('[data-test="text-editor-done"]')
    expect(done?.style.top).toBe('288px')
  })
})
