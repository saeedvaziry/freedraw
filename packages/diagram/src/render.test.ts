import { describe, expect, it } from 'vitest'
import { contentBounds } from '@freedraw/engine/geometry/fit'
import { exportCanvasSize } from '@freedraw/engine/render/exportScene'
import { buildScene } from './scene.js'
import { renderToCanvas } from './render.js'

const SAMPLE = 'flowchart TD\nA[Start] --> B[Done]'

describe('renderToCanvas', () => {
  it('returns null when the input has parse errors', () => {
    expect(renderToCanvas('definitely not a diagram')).toBeNull()
  })

  it('renders to a canvas sized to the fitted content', () => {
    const scene = buildScene(SAMPLE)
    const bounds = contentBounds(scene.snapshot)
    expect(bounds).not.toBeNull()

    const padding = 8
    const scale = 2
    const canvas = renderToCanvas(SAMPLE, { padding, scale })

    if (!canvas) {
      expect(canvas).toBeNull()
      return
    }

    const expected = exportCanvasSize(bounds!, padding, scale)
    expect(canvas.width).toBe(expected.width)
    expect(canvas.height).toBe(expected.height)
    expect(canvas.getContext('2d')).not.toBeNull()
  })
})
