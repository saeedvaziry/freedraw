import { describe, expect, it } from 'vitest'
import {
  GRID_SIZE,
  GRID_SNAP_SIZE,
  defaultGridConfig,
  gridLineValues,
  gridStepForZoom,
  isMajorGridValue,
  snapPointToGrid,
  snapValueToGrid,
} from './grid.js'

describe('snapValueToGrid', () => {
  it('rounds values to the nearest half-grid guide', () => {
    expect(snapValueToGrid(2)).toBe(0)
    expect(snapValueToGrid(3)).toBe(5)
    expect(snapValueToGrid(7)).toBe(5)
    expect(snapValueToGrid(8)).toBe(10)
  })

  it('normalizes negative zero', () => {
    expect(Object.is(snapValueToGrid(-1), -0)).toBe(false)
    expect(snapValueToGrid(-1)).toBe(0)
  })
})

describe('snapPointToGrid', () => {
  it('snaps both point axes to half-grid guides', () => {
    expect(snapPointToGrid({ x: 13, y: 47 })).toEqual({ x: 15, y: 45 })
  })
})

describe('gridLineValues', () => {
  it('starts at the nearest preceding visual grid line', () => {
    expect(gridLineValues(-3, 12)).toEqual([-GRID_SIZE, 0, GRID_SIZE])
  })

  it('does not include half-grid snap positions in the visual grid', () => {
    expect(gridLineValues(0, GRID_SIZE + GRID_SNAP_SIZE)).toEqual([0, GRID_SIZE])
  })
})

describe('gridStepForZoom', () => {
  it('uses major grid spacing when minor lines would be too dense', () => {
    expect(gridStepForZoom(defaultGridConfig, 1)).toBe(10)
    expect(gridStepForZoom(defaultGridConfig, 0.5)).toBe(50)
  })
})

describe('isMajorGridValue', () => {
  it('identifies emphasized grid lines', () => {
    expect(isMajorGridValue(50, defaultGridConfig)).toBe(true)
    expect(isMajorGridValue(40, defaultGridConfig)).toBe(false)
  })
})
