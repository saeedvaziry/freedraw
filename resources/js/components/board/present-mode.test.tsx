import { act, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorController, SceneStore } from '@freedraw/engine'
import type { BoardExport } from '@/hooks/board/use-export.js'
import type { PresentMode } from '@/hooks/board/use-present-mode.js'
import { BoardProvider, type BoardContextValue } from './board-context.js'
import { PresentOverlay } from './present-mode.js'

function createController() {
  const camera = { x: 0, y: 0, zoom: 1 }
  const listeners = new Set<() => void>()

  return {
    camera,
    viewportSize: { width: 800, height: 600 },
    worldToScreen: (point: { x: number; y: number }) => ({
      x: (point.x - camera.x) * camera.zoom,
      y: (point.y - camera.y) * camera.zoom,
    }),
    subscribeCamera: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    emit: () => listeners.forEach((listener) => listener()),
    listenerCount: () => listeners.size,
  }
}

type FakeController = ReturnType<typeof createController>

function presentMode(overrides: Partial<PresentMode> = {}): PresentMode {
  return {
    active: true,
    index: 0,
    count: 3,
    slideRect: { x: 100, y: 50, width: 200, height: 100 },
    enter: vi.fn(),
    exit: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    first: vi.fn(),
    last: vi.fn(),
    ...overrides,
  }
}

function boardValue(controller: FakeController): BoardContextValue {
  return {
    store: {} as unknown as SceneStore,
    controller: controller as unknown as EditorController,
    boardExport: {} as unknown as BoardExport,
    theme: 'light',
    readOnly: true,
    scope: 'view',
    openImagePicker: vi.fn(),
    sync: null,
  }
}

function renderOverlay(present: PresentMode = presentMode(), controller = createController()) {
  const view = render(
    createElement(BoardProvider, {
      value: boardValue(controller),
      children: createElement(PresentOverlay, { present }),
    }),
  )
  return { ...view, controller }
}

function spotlight(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="present-spotlight"]')
}

function geometry(): Record<string, string> {
  const host = spotlight()
  if (!host) throw new Error('Spotlight is not mounted')
  const read = (name: string) => host.style.getPropertyValue(name)
  return {
    left: read('--spotlight-left'),
    right: read('--spotlight-right'),
    top: read('--spotlight-top'),
    bottom: read('--spotlight-bottom'),
    height: read('--spotlight-height'),
  }
}

function timerLabel(): string {
  return screen.getByLabelText(/^Timer mode:/).textContent ?? ''
}

describe('PresentOverlay spotlight', () => {
  it('dims around the active slide in screen space', () => {
    renderOverlay()

    expect(spotlight()).not.toBeNull()
    expect(geometry()).toEqual({
      left: '100px',
      right: '300px',
      top: '50px',
      bottom: '150px',
      height: '100px',
    })
  })

  it('renders four bands that cannot swallow pointer events', () => {
    renderOverlay()

    const host = spotlight()

    expect(host?.className).toContain('pointer-events-none')
    expect(host?.children).toHaveLength(4)
  })

  it('renders nothing to dim on a board without slides', () => {
    renderOverlay(presentMode({ count: 0, slideRect: null }))

    expect(spotlight()).toBeNull()
    expect(screen.getByText('Presenting')).not.toBeNull()
    expect(screen.queryByLabelText('Turn off spotlight')).toBeNull()
  })

  it('follows the camera when the board pans and zooms', () => {
    const { controller } = renderOverlay()

    controller.camera.x = 50
    controller.camera.zoom = 2
    act(() => {
      controller.emit()
    })

    expect(geometry()).toEqual({
      left: '100px',
      right: '500px',
      top: '100px',
      bottom: '300px',
      height: '200px',
    })
  })

  it('clamps the dim to the viewport when the slide runs off screen', () => {
    const { controller } = renderOverlay(
      presentMode({ slideRect: { x: -400, y: -200, width: 2000, height: 2000 } }),
    )

    expect(geometry()).toEqual({
      left: '0px',
      right: '800px',
      top: '0px',
      bottom: '600px',
      height: '600px',
    })
    expect(controller.listenerCount()).toBe(1)
  })

  it('drops the dim and the camera subscription when the spotlight is switched off', () => {
    const { controller } = renderOverlay()

    fireEvent.click(screen.getByLabelText('Turn off spotlight'))

    expect(spotlight()).toBeNull()
    expect(controller.listenerCount()).toBe(0)
    expect(screen.getByLabelText('Turn on spotlight')).not.toBeNull()
  })
})

describe('PresentOverlay timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays out of the control cluster until it is asked for', () => {
    renderOverlay()

    expect(screen.queryByLabelText(/^Timer mode:/)).toBeNull()
    expect(screen.queryByLabelText('Pause timer')).toBeNull()
    expect(screen.getByLabelText('Show timer').getAttribute('aria-pressed')).toBeNull()
  })

  it('counts elapsed time once it is shown', () => {
    renderOverlay()

    fireEvent.click(screen.getByLabelText('Show timer'))

    expect(timerLabel()).toBe('00:00')
    expect(screen.getByLabelText('Hide timer').getAttribute('aria-pressed')).toBe('true')

    act(() => {
      vi.advanceTimersByTime(3_000)
    })

    expect(timerLabel()).toBe('00:03')
  })

  it('pauses, resumes and resets the count', () => {
    renderOverlay()

    fireEvent.click(screen.getByLabelText('Show timer'))
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    fireEvent.click(screen.getByLabelText('Pause timer'))
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(timerLabel()).toBe('00:05')

    fireEvent.click(screen.getByLabelText('Start timer'))
    act(() => {
      vi.advanceTimersByTime(2_000)
    })

    expect(timerLabel()).toBe('00:07')

    fireEvent.click(screen.getByLabelText('Reset timer'))

    expect(timerLabel()).toBe('00:00')
  })

  it('cycles into a countdown that runs into overtime', () => {
    renderOverlay()

    fireEvent.click(screen.getByLabelText('Show timer'))
    fireEvent.click(screen.getByLabelText('Timer mode: Elapsed'))

    expect(screen.getByLabelText('Timer mode: 5 min countdown')).not.toBeNull()
    expect(timerLabel()).toBe('05:00')

    act(() => {
      vi.advanceTimersByTime(4 * 60_000 + 59_000)
    })

    expect(timerLabel()).toBe('00:01')

    act(() => {
      vi.advanceTimersByTime(4_000)
    })

    expect(timerLabel()).toBe('-00:03')
  })

  it('hides the readout again and forgets the count', () => {
    renderOverlay()

    fireEvent.click(screen.getByLabelText('Show timer'))
    act(() => {
      vi.advanceTimersByTime(8_000)
    })
    fireEvent.click(screen.getByLabelText('Hide timer'))

    expect(screen.queryByLabelText(/^Timer mode:/)).toBeNull()

    fireEvent.click(screen.getByLabelText('Show timer'))

    expect(timerLabel()).toBe('00:00')
  })
})

describe('PresentOverlay navigation', () => {
  it('keeps the slide counter and the deck controls', () => {
    const present = presentMode({ index: 1 })
    renderOverlay(present)

    expect(screen.getByText('2 / 3')).not.toBeNull()

    fireEvent.click(screen.getByLabelText('Next slide'))
    fireEvent.click(screen.getByLabelText('Previous slide'))
    fireEvent.click(screen.getByLabelText('Exit present mode'))

    expect(present.next).toHaveBeenCalledTimes(1)
    expect(present.previous).toHaveBeenCalledTimes(1)
    expect(present.exit).toHaveBeenCalledTimes(1)
  })
})
