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
