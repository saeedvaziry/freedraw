import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS_COLORS,
  PRESENCE_COLORS,
  overlayColorsFrom,
  presenceColors,
  resolveCanvasColors,
} from './color-config.js'

describe('resolveCanvasColors', () => {
  it('returns the defaults when no overrides are given', () => {
    expect(resolveCanvasColors()).toEqual(DEFAULT_CANVAS_COLORS)
  })

  it('falls back to the default for absent values', () => {
    const resolved = resolveCanvasColors({
      gridBackground: undefined,
      selectionAccent: null,
      gridLine: '',
      gridMajor: '   ',
    })
    expect(resolved.gridBackground).toBe(DEFAULT_CANVAS_COLORS.gridBackground)
    expect(resolved.selectionAccent).toBe(DEFAULT_CANVAS_COLORS.selectionAccent)
    expect(resolved.gridLine).toBe(DEFAULT_CANVAS_COLORS.gridLine)
    expect(resolved.gridMajor).toBe(DEFAULT_CANVAS_COLORS.gridMajor)
  })

  it('rejects unsubstituted var() results and falls back to the default', () => {
    const resolved = resolveCanvasColors({
      selectionAccent: 'var(--selection-accent)',
      gridBackground: '  var(--canvas-grid-background)  ',
      selectionHandle: 'oklch(var(--handle) / 1)',
    })
    expect(resolved.selectionAccent).toBe(DEFAULT_CANVAS_COLORS.selectionAccent)
    expect(resolved.gridBackground).toBe(DEFAULT_CANVAS_COLORS.gridBackground)
    expect(resolved.selectionHandle).toBe(DEFAULT_CANVAS_COLORS.selectionHandle)
  })

  it('applies provided values and trims surrounding whitespace', () => {
    const resolved = resolveCanvasColors({
      selectionAccent: ' oklch(0.623 0.214 259.8) ',
      gridBackground: '#101010',
    })
    expect(resolved.selectionAccent).toBe('oklch(0.623 0.214 259.8)')
    expect(resolved.gridBackground).toBe('#101010')
    expect(resolved.gridLine).toBe(DEFAULT_CANVAS_COLORS.gridLine)
  })

  it('does not mutate the shared defaults', () => {
    resolveCanvasColors({ selectionAccent: '#000000' })
    expect(DEFAULT_CANVAS_COLORS.selectionAccent).toBe('#3b82f6')
  })
})

describe('overlayColorsFrom', () => {
  it('projects the selection colors used by the overlay painters', () => {
    const colors = resolveCanvasColors({
      selectionAccent: '#123456',
      selectionAccentSoft: 'rgba(1, 2, 3, 0.2)',
      selectionHandle: '#fefefe',
    })
    expect(overlayColorsFrom(colors)).toEqual({
      accent: '#123456',
      accentSoft: 'rgba(1, 2, 3, 0.2)',
      handle: '#fefefe',
    })
  })
})

describe('presenceColors', () => {
  it('exposes a high-contrast outline and label color for remote cursors', () => {
    expect(presenceColors()).toEqual({
      cursorOutline: '#ffffff',
      cursorLabelText: '#ffffff',
      laserCore: '#ffffff',
    })
  })

  it('exposes a high-contrast core for laser pointer trails', () => {
    expect(presenceColors().laserCore).toBe('#ffffff')
  })

  it('stays fixed regardless of the resolved canvas colors', () => {
    resolveCanvasColors({
      gridBackground: '#000000',
      selectionHandle: '#101010',
      selectionAccent: '#202020',
    })
    expect(presenceColors()).toEqual(PRESENCE_COLORS)
  })

  it('is not part of the themeable canvas color set', () => {
    expect(Object.keys(DEFAULT_CANVAS_COLORS)).not.toContain('cursorOutline')
    expect(Object.keys(DEFAULT_CANVAS_COLORS)).not.toContain('cursorLabelText')
    expect(Object.keys(DEFAULT_CANVAS_COLORS)).not.toContain('laserCore')
  })

  it('hands out a copy so callers cannot mutate the shared group', () => {
    const copy = presenceColors()
    copy.cursorOutline = '#000000'
    expect(PRESENCE_COLORS.cursorOutline).toBe('#ffffff')
    expect(presenceColors().cursorOutline).toBe('#ffffff')
  })
})
