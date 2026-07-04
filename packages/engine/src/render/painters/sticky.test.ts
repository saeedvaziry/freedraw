import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../../model/schema.js'
import type { StickyElement } from '../../model/types.js'
import { paintSticky } from './sticky.js'

interface FillOperation {
  fillStyle: string
  clipRule: CanvasFillRule | null
}

class RecordingContext {
  readonly canvas = { width: 800, height: 600 }
  readonly fills: FillOperation[] = []
  readonly clips: CanvasFillRule[] = []
  fillStyle: string | CanvasGradient | CanvasPattern = '#000'
  globalAlpha = 1
  lineJoin: CanvasLineJoin = 'miter'
  lineWidth = 1
  shadowBlur = 0
  shadowColor = 'transparent'
  shadowOffsetY = 0
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000'
  private activeClipRule: CanvasFillRule | null = null
  private readonly stack: (CanvasFillRule | null)[] = []

  save(): void {
    this.stack.push(this.activeClipRule)
  }

  restore(): void {
    this.activeClipRule = this.stack.pop() ?? null
  }

  beginPath(): void {}
  moveTo(_x: number, _y: number): void {}
  lineTo(_x: number, _y: number): void {}
  arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _radius: number): void {}
  closePath(): void {}
  setLineDash(_segments: number[]): void {}

  getTransform(): DOMMatrix {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } as DOMMatrix
  }

  clip(rule: CanvasFillRule = 'nonzero'): void {
    this.activeClipRule = rule
    this.clips.push(rule)
  }

  fill(): void {
    this.fills.push({
      fillStyle: String(this.fillStyle),
      clipRule: this.activeClipRule,
    })
  }
}

const transparentSticky: StickyElement = {
  id: 's1',
  type: 'sticky',
  x: 20,
  y: 30,
  width: 120,
  height: 80,
  rotation: 0,
  style: {
    ...defaultStyle,
    fill: 'rgba(253, 240, 138, 0.45)',
    opacity: 0.5,
    roundness: 12,
    strokeWidth: 0,
  },
}

describe('paintSticky', () => {
  it('clips the shadow caster out of transparent sticky notes', () => {
    const ctx = new RecordingContext()

    paintSticky(ctx as unknown as CanvasRenderingContext2D, transparentSticky)

    expect(ctx.clips).toContain('evenodd')
    expect(ctx.fills).toEqual([
      { fillStyle: '#000', clipRule: 'evenodd' },
      { fillStyle: transparentSticky.style.fill, clipRule: null },
    ])
  })
})
