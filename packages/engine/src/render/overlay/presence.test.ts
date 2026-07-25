import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/camera.js'
import { PRESENCE_COLORS, type PresenceColors } from '../color-config.js'
import { paintPresence, type PresenceOverlay } from './presence.js'

interface RecordedOp {
  op: string
  fillStyle: string
  strokeStyle: string
}

function recorder(): { ctx: CanvasRenderingContext2D; ops: RecordedOp[] } {
  const ops: RecordedOp[] = []
  const state = { fillStyle: '#000000', strokeStyle: '#000000' }
  const push = (op: string): void => {
    ops.push({ op, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle })
  }
  const noop = (): void => {}
  const ctx = {
    get fillStyle(): string {
      return state.fillStyle
    },
    set fillStyle(value: string) {
      state.fillStyle = value
    },
    get strokeStyle(): string {
      return state.strokeStyle
    },
    set strokeStyle(value: string) {
      state.strokeStyle = value
    },
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: noop,
    restore: noop,
    translate: noop,
    setLineDash: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arcTo: noop,
    closePath: noop,
    measureText: () => ({ width: 40 }),
    fill: () => push('fill'),
    stroke: () => push('stroke'),
    fillText: () => push('fillText'),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops }
}

const camera = new Camera({ x: 0, y: 0, zoom: 1 })

function overlayWithCursor(): PresenceOverlay {
  return {
    cursors: [{ id: 'u1', point: { x: 10, y: 20 }, color: '#123456', label: 'Ada' }],
    halos: [],
  }
}

describe('paintPresence', () => {
  it('outlines the cursor with the supplied presence color', () => {
    const { ctx, ops } = recorder()
    const colors: PresenceColors = { cursorOutline: '#00ff00', cursorLabelText: '#ff00ff' }
    paintPresence(ctx, overlayWithCursor(), camera, colors)
    const stroke = ops.find((entry) => entry.op === 'stroke')
    expect(stroke?.strokeStyle).toBe('#00ff00')
  })

  it('draws the label text with the supplied presence label color', () => {
    const { ctx, ops } = recorder()
    const colors: PresenceColors = { cursorOutline: '#00ff00', cursorLabelText: '#ff00ff' }
    paintPresence(ctx, overlayWithCursor(), camera, colors)
    const text = ops.find((entry) => entry.op === 'fillText')
    expect(text?.fillStyle).toBe('#ff00ff')
  })

  it('keeps the cursor body painted in the per-user color', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithCursor(), camera, PRESENCE_COLORS)
    const fill = ops.find((entry) => entry.op === 'fill')
    expect(fill?.fillStyle).toBe('#123456')
  })

  it('falls back to the shared presence colors when none are supplied', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithCursor(), camera)
    expect(ops.find((entry) => entry.op === 'stroke')?.strokeStyle).toBe(
      PRESENCE_COLORS.cursorOutline,
    )
    expect(ops.find((entry) => entry.op === 'fillText')?.fillStyle).toBe(
      PRESENCE_COLORS.cursorLabelText,
    )
  })

  it('strokes halos in the remote user color', () => {
    const { ctx, ops } = recorder()
    paintPresence(
      ctx,
      {
        cursors: [],
        halos: [
          {
            id: 'u1',
            color: '#abcdef',
            frame: {
              bounds: { x: 0, y: 0, width: 10, height: 10 },
              center: { x: 5, y: 5 },
              rotation: 0,
            },
          },
        ],
      },
      camera,
      PRESENCE_COLORS,
    )
    expect(ops.find((entry) => entry.op === 'stroke')?.strokeStyle).toBe('#abcdef')
  })
})
