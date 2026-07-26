import { describe, expect, it } from 'vitest'
import { RESIZE_HANDLE_IDS, resizeCursor, type ResizeHandleId } from './handles.js'

const QUARTER = Math.PI / 2

describe('resizeCursor', () => {
  it('maps every handle of an upright frame to its own axis', () => {
    const cursors = RESIZE_HANDLE_IDS.map((handle) => [handle, resizeCursor(handle, 0)])

    expect(Object.fromEntries(cursors)).toEqual({
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize',
      nw: 'nwse-resize',
      se: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
    })
  })

  it('reads a quarter-turned frame with the axes swapped', () => {
    expect(resizeCursor('n', QUARTER)).toBe('ew-resize')
    expect(resizeCursor('e', QUARTER)).toBe('ns-resize')
    expect(resizeCursor('nw', QUARTER)).toBe('nesw-resize')
    expect(resizeCursor('ne', QUARTER)).toBe('nwse-resize')
  })

  it('reads a counter-clockwise quarter turn the same way as a clockwise one', () => {
    for (const handle of RESIZE_HANDLE_IDS) {
      expect(resizeCursor(handle, -QUARTER)).toBe(resizeCursor(handle, QUARTER))
    }
  })

  it('steps to the neighbouring cursor on a half-turned diagonal frame', () => {
    expect(resizeCursor('n', Math.PI / 4)).toBe('nesw-resize')
    expect(resizeCursor('e', Math.PI / 4)).toBe('nwse-resize')
  })

  it('is unchanged by a half turn because opposite handles share a cursor', () => {
    for (const handle of RESIZE_HANDLE_IDS) {
      expect(resizeCursor(handle, Math.PI)).toBe(resizeCursor(handle, 0))
    }
  })

  it('keeps the upright cursor for a rotation below half an octant', () => {
    const almost = Math.PI / 8 - 0.01
    for (const handle of RESIZE_HANDLE_IDS) {
      expect(resizeCursor(handle, almost)).toBe(resizeCursor(handle, 0))
    }
  })

  it('defaults to an unrotated frame', () => {
    const handles: ResizeHandleId[] = ['n', 'ne']
    expect(handles.map((handle) => resizeCursor(handle))).toEqual(['ns-resize', 'nesw-resize'])
  })
})
