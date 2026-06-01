import type { Point } from '../model/types.js'

export const GRID_SIZE = 10
export const GRID_SNAP_SIZE = GRID_SIZE / 2
export const GRID_MAJOR_EVERY = 5
export const GRID_MIN_SCREEN_SPACING = 8

export interface GridConfig {
  spacing: number
  majorEvery: number
}

export const defaultGridConfig: GridConfig = {
  spacing: GRID_SIZE,
  majorEvery: GRID_MAJOR_EVERY,
}

export function snapValueToGrid(value: number, spacing = GRID_SNAP_SIZE): number {
  const normalized = normalizedGridSpacing(spacing)
  if (!Number.isFinite(value)) return value
  return cleanZero(Math.round(value / normalized) * normalized)
}

export function snapPointToGrid(point: Point, spacing = GRID_SNAP_SIZE): Point {
  return {
    x: snapValueToGrid(point.x, spacing),
    y: snapValueToGrid(point.y, spacing),
  }
}

export function gridStepForZoom(
  config: GridConfig,
  zoom: number,
  minScreenSpacing = GRID_MIN_SCREEN_SPACING,
): number {
  const base = normalizedGridSpacing(config.spacing)
  const majorEvery = normalizedMajorEvery(config.majorEvery)
  if (majorEvery === 1 || !Number.isFinite(zoom) || zoom <= 0) return base

  let step = base
  while (step * zoom < minScreenSpacing) step *= majorEvery
  return step
}

export function gridLineValues(min: number, max: number, step = GRID_SIZE): number[] {
  const normalized = normalizedGridSpacing(step)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return []

  const start = Math.floor(Math.min(min, max) / normalized) * normalized
  const end = Math.max(min, max)
  const values: number[] = []
  for (let value = start; value <= end; value += normalized) {
    values.push(cleanZero(value))
  }
  return values
}

export function isMajorGridValue(value: number, config: GridConfig): boolean {
  const majorSpacing = normalizedGridSpacing(config.spacing) * normalizedMajorEvery(config.majorEvery)
  return Math.abs(value / majorSpacing - Math.round(value / majorSpacing)) < 0.000001
}

function normalizedGridSpacing(spacing: number): number {
  if (!Number.isFinite(spacing) || spacing <= 0) return GRID_SIZE
  return spacing
}

function normalizedMajorEvery(majorEvery: number): number {
  if (!Number.isFinite(majorEvery) || majorEvery < 1) return GRID_MAJOR_EVERY
  return Math.max(1, Math.round(majorEvery))
}

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}
