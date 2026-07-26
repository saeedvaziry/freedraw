import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorController } from '@freedraw/engine'
import { LASER_TRAIL_MS } from '@/lib/presence'
import { useLaser } from './use-laser.js'

const NOW = 1_000_000

interface FakeController {
  cursorWorldPoint: { x: number; y: number } | null
  subscribeCursor(listener: (point: { x: number; y: number } | null) => void): () => void
  move(point: { x: number; y: number } | null): void
  listeners(): number
}

function createController(seed: { x: number; y: number } | null = null): FakeController {
  const listeners = new Set<(point: { x: number; y: number } | null) => void>()
  let world = seed

  return {
    get cursorWorldPoint() {
      return world
    },
    subscribeCursor(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    move(point) {
      world = point
      listeners.forEach((listener) => listener(point))
    },
    listeners: () => listeners.size,
  }
}

function mount(controller: FakeController | null, readOnly = false) {
  return renderHook(() =>
    useLaser({
      controller: controller as unknown as EditorController | null,
      readOnly,
      now: () => Date.now(),
    }),
  )
}

function canvasEvent(type: string, button = 0): PointerEvent {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button })
  canvas.dispatchEvent(event)
  canvas.remove()
  return event as PointerEvent
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useLaser', () => {
  it('starts idle and traces nothing until it is armed', () => {
    const controller = createController()
    const { result } = mount(controller)

    expect(result.current.active).toBe(false)
    expect(result.current.source).toBeNull()
    expect(controller.listeners()).toBe(0)

    act(() => controller.move({ x: 1, y: 1 }))

    expect(result.current.store.isEmpty()).toBe(true)
  })

  it('traces the pointer into the trail once it is toggled on', () => {
    const controller = createController()
    const { result } = mount(controller)

    act(() => result.current.toggle())

    expect(result.current.active).toBe(true)
    expect(result.current.source).not.toBeNull()
    expect(controller.listeners()).toBe(1)

    act(() => controller.move({ x: 10, y: 0 }))
    act(() => controller.move({ x: 20, y: 0 }))

    expect(result.current.source?.read(Date.now())?.points).toEqual([
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ])
  })

  it('seeds the trail from the cursor the controller already knows', () => {
    const controller = createController({ x: 4, y: 4 })
    const { result } = mount(controller)

    act(() => result.current.activate())

    expect(result.current.store.read(Date.now())?.points).toEqual([{ x: 4, y: 4 }])
  })

  it('ignores a pointer that left the canvas', () => {
    const controller = createController()
    const { result } = mount(controller)

    act(() => result.current.activate())
    act(() => controller.move(null))

    expect(result.current.store.isEmpty()).toBe(true)
  })

  it('fades the resting trail out frame by frame', () => {
    const controller = createController()
    const { result } = mount(controller)

    act(() => result.current.activate())
    act(() => controller.move({ x: 10, y: 0 }))

    expect(result.current.store.isEmpty()).toBe(false)

    act(() => {
      vi.advanceTimersByTime(LASER_TRAIL_MS + 64)
    })

    expect(result.current.store.isEmpty()).toBe(true)
  })

  it('swallows a primary press on the canvas so the laser never draws', () => {
    const controller = createController()
    const { result } = mount(controller)

    act(() => result.current.activate())
    const down = canvasEvent('pointerdown')
    const double = canvasEvent('dblclick')

    expect(down.defaultPrevented).toBe(true)
    expect(double.defaultPrevented).toBe(true)
  })

  it('leaves secondary presses and off-canvas presses alone', () => {
    const controller = createController()
    const { result } = mount(controller)

    act(() => result.current.activate())
    const middle = canvasEvent('pointerdown', 1)
    const button = document.createElement('button')
    document.body.append(button)
    const onButton = new MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    button.dispatchEvent(onButton)
    button.remove()

    expect(middle.defaultPrevented).toBe(false)
    expect(onButton.defaultPrevented).toBe(false)
  })

  it('passes the pointer back to the canvas once it is switched off', () => {
    const controller = createController()
    const { result } = mount(controller)

    act(() => result.current.activate())
    act(() => controller.move({ x: 10, y: 0 }))
    act(() => result.current.deactivate())

    expect(result.current.active).toBe(false)
    expect(result.current.source).toBeNull()
    expect(result.current.store.isEmpty()).toBe(true)
    expect(controller.listeners()).toBe(0)
    expect(canvasEvent('pointerdown').defaultPrevented).toBe(false)
  })

  it('is a no-op for a read-only viewer', () => {
    const controller = createController()
    const { result } = mount(controller, true)

    act(() => result.current.toggle())
    act(() => result.current.activate())

    expect(result.current.available).toBe(false)
    expect(result.current.active).toBe(false)
    expect(result.current.source).toBeNull()
    expect(controller.listeners()).toBe(0)
    expect(canvasEvent('pointerdown').defaultPrevented).toBe(false)
  })

  it('disarms when the board turns read-only mid session', () => {
    const controller = createController()
    const { result, rerender } = renderHook(
      ({ readOnly }: { readOnly: boolean }) =>
        useLaser({
          controller: controller as unknown as EditorController,
          readOnly,
        }),
      { initialProps: { readOnly: false } },
    )

    act(() => result.current.activate())

    expect(result.current.active).toBe(true)

    rerender({ readOnly: true })

    expect(result.current.active).toBe(false)
    expect(controller.listeners()).toBe(0)
  })

  it('drops the trail when the window loses focus', () => {
    const controller = createController()
    const { result } = mount(controller)

    act(() => result.current.activate())
    act(() => controller.move({ x: 10, y: 0 }))
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(result.current.store.isEmpty()).toBe(true)
    expect(result.current.active).toBe(true)
  })

  it('waits for a controller before it arms', () => {
    const { result } = mount(null)

    act(() => result.current.activate())

    expect(result.current.active).toBe(false)
    expect(result.current.source).toBeNull()
  })

  it('detaches every listener when the board unmounts', () => {
    const controller = createController()
    const { result, unmount } = mount(controller)

    act(() => result.current.activate())
    act(() => controller.move({ x: 10, y: 0 }))
    unmount()

    expect(controller.listeners()).toBe(0)
    expect(canvasEvent('pointerdown').defaultPrevented).toBe(false)
  })
})
