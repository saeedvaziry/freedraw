import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../../model/schema.js'
import type { StickyElement } from '../../model/types.js'
import { invertColor } from '../invert.js'
import { BASE_SHADOW_DARK, BASE_SHADOW_LIGHT, paintSticky } from './sticky.js'

interface FillOperation {
  fillStyle: string
  clipRule: CanvasFillRule | null
  shadowColor: string
}

interface RecordingState {
  clipRule: CanvasFillRule | null
  shadowColor: string
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
  private readonly stack: RecordingState[] = []

  save(): void {
    this.stack.push({ clipRule: this.activeClipRule, shadowColor: this.shadowColor })
  }

  restore(): void {
    const state = this.stack.pop()
    if (!state) return
    this.activeClipRule = state.clipRule
    this.shadowColor = state.shadowColor
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
      shadowColor: String(this.shadowColor),
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

    paintSticky(ctx as unknown as CanvasRenderingContext2D, transparentSticky, false)

    expect(ctx.clips).toContain('evenodd')
    expect(ctx.fills).toEqual([
      { fillStyle: '#000', clipRule: 'evenodd', shadowColor: BASE_SHADOW_LIGHT },
      { fillStyle: transparentSticky.style.fill, clipRule: null, shadowColor: 'transparent' },
    ])
  })

  it('keeps the fill uninverted and only swaps the shadow color in dark mode', () => {
    const ctx = new RecordingContext()

    paintSticky(ctx as unknown as CanvasRenderingContext2D, transparentSticky, true)

    expect(ctx.fills).toEqual([
      { fillStyle: '#000', clipRule: 'evenodd', shadowColor: BASE_SHADOW_DARK },
      { fillStyle: transparentSticky.style.fill, clipRule: null, shadowColor: 'transparent' },
    ])
    expect(BASE_SHADOW_DARK).not.toBe(invertColor(BASE_SHADOW_LIGHT))
  })
})
