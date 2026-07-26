import { act, render } from '@testing-library/react'
import { createElement, createRef } from 'react'
import { describe, expect, it } from 'vitest'
import type { EditorController } from '@freedraw/engine'
import { CanvasHost } from './canvas-host.js'

type CursorListener = (cursor: string) => void

function fakeController(initial: string) {
  const listeners = new Set<CursorListener>()
  let cursor = initial

  const controller = {
    get activeCursorStyle() {
      return cursor
    },
    subscribeCursorStyle(listener: CursorListener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    subscribeEdit() {
      return () => undefined
    },
  }

  return {
    controller: controller as unknown as EditorController,
    listeners,
    emit(next: string) {
      cursor = next
      act(() => listeners.forEach((listener) => listener(next)))
    },
  }
}

function renderHost(controller: EditorController | null) {
  return render(
    createElement(CanvasHost, {
      sceneRef: createRef<HTMLCanvasElement>(),
      overlayRef: createRef<HTMLCanvasElement>(),
      controller,
    }),
  )
}

function overlayCursor(): string {
  const canvases = document.querySelectorAll('canvas')
  return (canvases[1] as HTMLCanvasElement).style.cursor
}

function overlay(): HTMLCanvasElement {
  return document.querySelectorAll('canvas')[1] as HTMLCanvasElement
}

describe('CanvasHost cursor', () => {
  it('renders the default cursor before a controller exists', () => {
    renderHost(null)

    expect(overlayCursor()).toBe('default')
  })

  it('adopts the cursor the controller already reports', () => {
    const { controller } = fakeController('crosshair')

    renderHost(controller)

    expect(overlayCursor()).toBe('crosshair')
  })

  it('applies every cursor the controller emits to the overlay canvas', () => {
    const { controller, emit } = fakeController('grab')

    renderHost(controller)
    emit('grabbing')

    expect(overlayCursor()).toBe('grabbing')

    emit('nwse-resize')

    expect(overlayCursor()).toBe('nwse-resize')
  })

  it('leaves the scene canvas cursor alone', () => {
    const { controller, emit } = fakeController('default')

    renderHost(controller)
    emit('crosshair')

    const scene = document.querySelectorAll('canvas')[0] as HTMLCanvasElement
    expect(scene.style.cursor).toBe('')
  })

  it('unsubscribes from the cursor channel on unmount', () => {
    const { controller, listeners } = fakeController('default')

    const view = renderHost(controller)
    expect(listeners.size).toBe(1)

    view.unmount()

    expect(listeners.size).toBe(0)
  })
})

describe('CanvasHost accessibility', () => {
  it('makes the overlay canvas focusable with a name and a role', () => {
    renderHost(null)

    const canvas = overlay()

    expect(canvas.getAttribute('tabindex')).toBe('0')
    expect(canvas.getAttribute('role')).toBe('application')
    expect(canvas.getAttribute('aria-label')).toBe('Board canvas')
    expect(canvas.getAttribute('aria-keyshortcuts')).toContain('PageDown')
    expect(canvas.getAttribute('aria-keyshortcuts')).toContain('Shift+ArrowUp')
  })

  it('points the overlay canvas at a hidden description of the keyboard scheme', () => {
    renderHost(null)

    const id = overlay().getAttribute('aria-describedby')
    const help = id ? document.getElementById(id) : null

    expect(help).not.toBeNull()
    expect(help?.className).toContain('sr-only')
    expect(help?.className).not.toContain('hidden')
    expect(help?.textContent).toContain('Page Down')
    expect(help?.textContent).toContain('arrow key')
  })

  it('hides the scene canvas from assistive technology', () => {
    renderHost(null)

    const scene = document.querySelectorAll('canvas')[0] as HTMLCanvasElement

    expect(scene.getAttribute('aria-hidden')).toBe('true')
    expect(scene.getAttribute('tabindex')).toBeNull()
  })

  it('renders a polite live region that stays out of the layout without display none', () => {
    renderHost(null)

    const region = document.querySelector('[data-test="canvas-live-region"]')

    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.getAttribute('role')).toBe('status')
    expect(region?.className).toContain('sr-only')
    expect(region?.className).not.toContain('hidden')
  })

  it('keeps the focus ring inside the full bleed canvas', () => {
    renderHost(null)

    expect(overlay().className).toContain('focus-visible:-outline-offset-2')
  })
})
