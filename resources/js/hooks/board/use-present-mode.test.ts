import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorController, SceneStore, Slide } from '@freedraw/engine'
import { usePresentMode } from './use-present-mode.js'

function slide(id: string, order: number, x: number): Slide {
  return { id, name: `Slide ${id}`, rect: { x, y: 0, width: 100, height: 50 }, order } as Slide
}

const unordered = [slide('c', 3, 200), slide('a', 1, 0), slide('b', 2, 100)]

function fakeStore(slides: Slide[]): SceneStore {
  return { getSlides: () => slides } as unknown as SceneStore
}

function fakeController(isReadOnly = false) {
  return {
    isReadOnly,
    setReadOnly: vi.fn(),
    zoomToRect: vi.fn(),
    zoomToFit: vi.fn(),
  }
}

function setup(slides: Slide[] = unordered, controller = fakeController()) {
  const view = renderHook(
    ({ target }: { target: ReturnType<typeof fakeController> | null }) =>
      usePresentMode(target as unknown as EditorController | null, fakeStore(slides)),
    { initialProps: { target: controller as ReturnType<typeof fakeController> | null } },
  )
  return { ...view, controller }
}

function press(key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    window.dispatchEvent(event)
  })
  return event.defaultPrevented
}

const requestFullscreen = vi.fn()
const exitFullscreen = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  requestFullscreen.mockResolvedValue(undefined)
  exitFullscreen.mockResolvedValue(undefined)
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen,
  })
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  })
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
    writable: true,
  })
})

afterEach(() => {
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
    writable: true,
  })
})

describe('usePresentMode entering', () => {
  it('starts inactive and counts nothing before it is entered', () => {
    const { result, controller } = setup()

    expect(result.current.active).toBe(false)
    expect(result.current.count).toBe(0)
    expect(result.current.index).toBe(0)
    expect(controller.zoomToRect).not.toHaveBeenCalled()
  })

  it('sorts the slides by order, frames the first and locks the canvas', () => {
    const { result, controller } = setup()

    act(() => {
      result.current.enter()
    })

    expect(result.current.active).toBe(true)
    expect(result.current.count).toBe(3)
    expect(result.current.index).toBe(0)
    expect(controller.zoomToRect).toHaveBeenCalledWith(unordered[1].rect)
    expect(controller.setReadOnly).toHaveBeenCalledWith(true)
    expect(requestFullscreen).toHaveBeenCalled()
  })

  it('falls back to zoom-to-fit on a board without slides', () => {
    const { result, controller } = setup([])

    act(() => {
      result.current.enter()
    })

    expect(result.current.active).toBe(true)
    expect(result.current.count).toBe(0)
    expect(controller.zoomToFit).toHaveBeenCalledTimes(1)
    expect(controller.zoomToRect).not.toHaveBeenCalled()
  })

  it('does nothing without a controller', () => {
    const { result } = setup(unordered, null as unknown as ReturnType<typeof fakeController>)

    act(() => {
      result.current.enter()
    })

    expect(result.current.active).toBe(false)
  })

  it('ignores a second enter while already presenting', () => {
    const { result, controller } = setup()

    act(() => {
      result.current.enter()
    })
    controller.setReadOnly.mockClear()
    act(() => {
      result.current.enter()
    })

    expect(controller.setReadOnly).not.toHaveBeenCalled()
  })
})

describe('usePresentMode navigation', () => {
  it('steps forward and back and clamps at both ends', () => {
    const { result, controller } = setup()

    act(() => {
      result.current.enter()
    })
    act(() => {
      result.current.previous()
    })

    expect(result.current.index).toBe(0)

    act(() => {
      result.current.next()
    })

    expect(result.current.index).toBe(1)
    expect(controller.zoomToRect).toHaveBeenLastCalledWith(unordered[2].rect)

    act(() => {
      result.current.last()
    })

    expect(result.current.index).toBe(2)

    act(() => {
      result.current.next()
    })

    expect(result.current.index).toBe(2)
  })

  it('jumps back to the first slide', () => {
    const { result } = setup()

    act(() => {
      result.current.enter()
      result.current.last()
    })
    act(() => {
      result.current.first()
    })

    expect(result.current.index).toBe(0)
  })

  it('does not move on a board without slides', () => {
    const { result, controller } = setup([])

    act(() => {
      result.current.enter()
    })
    controller.zoomToFit.mockClear()
    act(() => {
      result.current.next()
    })

    expect(result.current.index).toBe(0)
    expect(controller.zoomToFit).not.toHaveBeenCalled()
  })
})

describe('usePresentMode keyboard', () => {
  it('ignores presentation keys before it is entered', () => {
    const { result } = setup()

    expect(press('ArrowRight')).toBe(false)
    expect(result.current.index).toBe(0)
  })

  it('drives the deck from the keyboard and swallows the keys it handles', () => {
    const { result } = setup()

    act(() => {
      result.current.enter()
    })

    expect(press('ArrowRight')).toBe(true)
    expect(result.current.index).toBe(1)

    expect(press('End')).toBe(true)
    expect(result.current.index).toBe(2)

    expect(press('ArrowLeft')).toBe(true)
    expect(result.current.index).toBe(1)

    expect(press('Home')).toBe(true)
    expect(result.current.index).toBe(0)
  })

  it('leaves keys it does not own alone', () => {
    const { result } = setup()

    act(() => {
      result.current.enter()
    })

    expect(press('a')).toBe(false)
  })

  it('exits on Escape', () => {
    const { result } = setup()

    act(() => {
      result.current.enter()
    })

    expect(press('Escape')).toBe(true)
    expect(result.current.active).toBe(false)
  })

  it('stops listening once the hook unmounts', () => {
    const { result, unmount } = setup()

    act(() => {
      result.current.enter()
    })
    unmount()

    expect(press('ArrowRight')).toBe(false)
  })
})

describe('usePresentMode leaving', () => {
  it('restores the read-only flag the canvas had before', () => {
    const { result, controller } = setup(unordered, fakeController(true))

    act(() => {
      result.current.enter()
    })
    act(() => {
      result.current.exit()
    })

    expect(result.current.active).toBe(false)
    expect(controller.setReadOnly).toHaveBeenLastCalledWith(true)
  })

  it('unlocks a canvas that was editable before presenting', () => {
    const { result, controller } = setup()

    act(() => {
      result.current.enter()
    })
    act(() => {
      result.current.exit()
    })

    expect(controller.setReadOnly).toHaveBeenLastCalledWith(false)
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it('leaves the browser fullscreen it opened', () => {
    const { result } = setup()

    act(() => {
      result.current.enter()
    })
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
      writable: true,
    })
    act(() => {
      result.current.exit()
    })

    expect(exitFullscreen).toHaveBeenCalledTimes(1)
  })

  it('exits when the browser drops out of fullscreen on its own', () => {
    const { result } = setup()

    act(() => {
      result.current.enter()
    })
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    expect(result.current.active).toBe(false)
  })

  it('ignores an exit when it is not presenting', () => {
    const { result, controller } = setup()

    act(() => {
      result.current.exit()
    })

    expect(controller.setReadOnly).not.toHaveBeenCalled()
  })
})
