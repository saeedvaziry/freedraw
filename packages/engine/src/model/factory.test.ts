import { describe, expect, it } from 'vitest'
import {
  createFreedraw,
  createImage,
  createSticky,
  fitToViewport,
  STICKY_FILL,
  STICKY_STROKE,
} from './factory.js'

describe('createSticky', () => {
  it('uses yellow defaults and a centered label-ready style', () => {
    const sticky = createSticky({ x: 10, y: 20 })
    expect(sticky.type).toBe('sticky')
    expect(sticky.style.fill).toBe(STICKY_FILL)
    expect(sticky.style.stroke).toBe(STICKY_STROKE)
    expect(sticky.style.textAlign).toBe('center')
    expect(sticky.style.roundness).toBeGreaterThan(0)
    expect(sticky.width).toBeGreaterThan(0)
    expect(sticky.height).toBeGreaterThan(0)
  })
})

describe('fitToViewport', () => {
  it('caps a huge natural size while preserving aspect ratio', () => {
    const { width, height } = fitToViewport(4000, 2000, 1000, 800)
    expect(width).toBeLessThanOrEqual(1000 * 0.8)
    expect(height).toBeLessThanOrEqual(800 * 0.8)
    expect(width / height).toBeCloseTo(2)
  })

  it('leaves a small natural size unchanged', () => {
    const { width, height } = fitToViewport(100, 50, 1000, 800)
    expect(width).toBe(100)
    expect(height).toBe(50)
  })
})

describe('createFreedraw', () => {
  it('derives the AABB from the captured points', () => {
    const freedraw = createFreedraw({
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 5 },
        { x: 25, y: 50 },
      ],
    })
    expect(freedraw.type).toBe('freedraw')
    expect(freedraw).toMatchObject({ x: 10, y: 5, width: 30, height: 45, rotation: 0 })
    expect(freedraw.points).toHaveLength(3)
  })
})

describe('createImage', () => {
  it('fits the image into the viewport and stores the assetId', () => {
    const image = createImage({
      assetId: 'asset-1',
      x: 0,
      y: 0,
      naturalWidth: 4000,
      naturalHeight: 2000,
      viewportWidth: 1000,
      viewportHeight: 800,
    })
    expect(image.type).toBe('image')
    expect(image.assetId).toBe('asset-1')
    expect(image.width).toBeLessThanOrEqual(800)
    expect(image.width / image.height).toBeCloseTo(2)
  })
})
