import { describe, expect, it } from 'vitest'
import {
  ROTATE_HANDLE_CLEARANCE,
  TOOLBAR_GAP,
  TOOLBAR_MARGIN,
  toolbarPlacement,
  type ToolbarAnchor,
} from './toolbar-placement.js'

const SIZE = { width: 200, height: 48 }
const VIEWPORT = 1400

function anchorAt(top: number, bottom: number, centerX = 600): ToolbarAnchor {
  return { centerX, top, bottom }
}

describe('toolbarPlacement', () => {
  it('sits one gap above the selection when nothing is in the way', () => {
    const placement = toolbarPlacement(anchorAt(300, 400), SIZE, VIEWPORT, null)
    expect(placement).toEqual({ left: 600, top: 300 - TOOLBAR_GAP, below: false })
  })

  it('clamps horizontally inside the viewport margins', () => {
    expect(toolbarPlacement(anchorAt(300, 400, 10), SIZE, VIEWPORT, null).left).toBe(
      SIZE.width / 2 + TOOLBAR_MARGIN,
    )
    expect(toolbarPlacement(anchorAt(300, 400, 1390), SIZE, VIEWPORT, null).left).toBe(
      VIEWPORT - SIZE.width / 2 - TOOLBAR_MARGIN,
    )
  })

  it('lifts above the rotate handle instead of covering it', () => {
    const handle = { x: 600, y: 252 }
    const placement = toolbarPlacement(anchorAt(300, 400), SIZE, VIEWPORT, handle)
    expect(placement.below).toBe(false)
    expect(placement.top).toBe(handle.y - ROTATE_HANDLE_CLEARANCE)
    expect(placement.top).toBeLessThanOrEqual(handle.y - ROTATE_HANDLE_CLEARANCE)
  })

  it('leaves the placement alone when the handle is clear of the pill horizontally', () => {
    const placement = toolbarPlacement(anchorAt(300, 400), SIZE, VIEWPORT, { x: 900, y: 252 })
    expect(placement.top).toBe(300 - TOOLBAR_GAP)
  })

  it('flips below when clearing the handle would push it off the top', () => {
    const placement = toolbarPlacement(anchorAt(70, 200), SIZE, VIEWPORT, { x: 600, y: 22 })
    expect(placement.below).toBe(true)
    expect(placement.top).toBe(200 + TOOLBAR_GAP)
  })

  it('pushes past a downward-pointing handle when flipped below', () => {
    const handle = { x: 600, y: 240 }
    const placement = toolbarPlacement(anchorAt(50, 200), SIZE, VIEWPORT, handle)
    expect(placement.below).toBe(true)
    expect(placement.top).toBe(handle.y + ROTATE_HANDLE_CLEARANCE)
  })

  it('never overlaps the handle circle in either direction', () => {
    for (const top of [40, 90, 300, 600]) {
      const handle = { x: 600, y: top - 48 }
      const placement = toolbarPlacement(anchorAt(top, top + 100), SIZE, VIEWPORT, handle)
      const rectTop = placement.below ? placement.top : placement.top - SIZE.height
      const rectBottom = placement.below ? placement.top + SIZE.height : placement.top
      const overlapsY =
        handle.y + ROTATE_HANDLE_CLEARANCE > rectTop &&
        handle.y - ROTATE_HANDLE_CLEARANCE < rectBottom
      expect(overlapsY).toBe(false)
    }
  })
})
