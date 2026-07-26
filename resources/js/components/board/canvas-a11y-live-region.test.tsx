import { act, render } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { announceCanvas } from '@/hooks/board/use-canvas-a11y.js'
import { CanvasA11yLiveRegion } from './canvas-a11y-live-region.js'

function region(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-test="canvas-live-region"]')
}

function announce(message: string): void {
  act(() => announceCanvas(message))
}

describe('CanvasA11yLiveRegion', () => {
  it('starts empty so nothing is read out on mount', () => {
    render(createElement(CanvasA11yLiveRegion))

    expect(region()?.textContent).toBe('')
  })

  it('renders the announcement text verbatim', () => {
    render(createElement(CanvasA11yLiveRegion))

    announce('Rectangle, 1 of 12 selected')

    expect(region()?.textContent).toBe('Rectangle, 1 of 12 selected')
  })

  it('replaces the previous announcement instead of appending to it', () => {
    render(createElement(CanvasA11yLiveRegion))

    announce('Rectangle, 1 of 12 selected')
    announce('Moved Rectangle right by 1')

    expect(region()?.textContent).toBe('Moved Rectangle right by 1')
  })

  it('remounts the text node so a repeated message is read again', () => {
    render(createElement(CanvasA11yLiveRegion))

    announce('Moved Rectangle right by 1')
    const first = region()?.firstElementChild
    announce('Moved Rectangle right by 1')
    const second = region()?.firstElementChild

    expect(region()?.textContent).toBe('Moved Rectangle right by 1')
    expect(second).not.toBe(first)
  })

  it('is hidden visually but never with display none', () => {
    render(createElement(CanvasA11yLiveRegion))

    const className = region()?.className ?? ''

    expect(className).toContain('sr-only')
    expect(className).not.toContain('hidden')
    expect(className).toContain('pointer-events-none')
  })

  it('ignores announcements made after it unmounts', () => {
    const view = render(createElement(CanvasA11yLiveRegion))

    view.unmount()

    expect(() => announceCanvas('Nothing selected')).not.toThrow()
    expect(region()).toBeNull()
  })
})
