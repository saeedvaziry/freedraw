import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/camera.js'
import type { SelectionFrame } from '../../geometry/handles.js'
import { PRESENCE_COLORS, type PresenceColors } from '../color-config.js'
import {
  paintPresence,
  PRESENCE_GHOST_ALPHA,
  PRESENCE_GHOST_FILL_ALPHA,
  PRESENCE_PREVIEW_ALPHA,
  PRESENCE_PREVIEW_DASH,
  type PresenceOverlay,
} from './presence.js'

interface RecordedOp {
  op: string
  fillStyle: string
  strokeStyle: string
  globalAlpha: number
  lineDash: number[]
}

function recorder(): { ctx: CanvasRenderingContext2D; ops: RecordedOp[] } {
  const ops: RecordedOp[] = []
  const state = { fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1 }
  let lineDash: number[] = []
  const push = (op: string): void => {
    ops.push({
      op,
      fillStyle: state.fillStyle,
      strokeStyle: state.strokeStyle,
      globalAlpha: state.globalAlpha,
      lineDash: [...lineDash],
    })
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
    get globalAlpha(): number {
      return state.globalAlpha
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value
    },
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: noop,
    restore: noop,
    translate: noop,
    setLineDash: (segments: number[]) => {
      lineDash = segments
    },
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
    ghosts: [],
  }
}

function frameAt(x: number, rotation = 0): SelectionFrame {
  return {
    bounds: { x, y: 0, width: 10, height: 10 },
    rotation,
    center: { x: x + 5, y: 5 },
  }
}

function overlayWithGhost(frames: SelectionFrame[]): PresenceOverlay {
  return {
    cursors: [],
    halos: [],
    ghosts: [{ id: 'u1', frames, color: '#abcdef' }],
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
        ghosts: [],
      },
      camera,
      PRESENCE_COLORS,
    )
    expect(ops.find((entry) => entry.op === 'stroke')?.strokeStyle).toBe('#abcdef')
  })

  it('dashes the halo of a peer previewing an element that does not exist yet', () => {
    const { ctx, ops } = recorder()
    paintPresence(
      ctx,
      {
        cursors: [],
        halos: [{ id: 'u1', frame: frameAt(0), color: '#abcdef', preview: true }],
        ghosts: [],
      },
      camera,
      PRESENCE_COLORS,
    )
    const stroke = ops.find((entry) => entry.op === 'stroke')
    expect(stroke?.lineDash).toEqual([...PRESENCE_PREVIEW_DASH])
    expect(stroke?.globalAlpha).toBe(PRESENCE_PREVIEW_ALPHA)
    expect(stroke?.strokeStyle).toBe('#abcdef')
  })

  it('keeps a committed selection halo solid', () => {
    const { ctx, ops } = recorder()
    paintPresence(
      ctx,
      { cursors: [], halos: [{ id: 'u1', frame: frameAt(0), color: '#abcdef' }], ghosts: [] },
      camera,
      PRESENCE_COLORS,
    )
    const stroke = ops.find((entry) => entry.op === 'stroke')
    expect(stroke?.lineDash).toEqual([])
    expect(stroke?.globalAlpha).toBe(1)
  })

  it('paints drag ghosts in the remote user color at half opacity', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithGhost([frameAt(40)]), camera, PRESENCE_COLORS)
    const stroke = ops.find((entry) => entry.op === 'stroke')
    const fill = ops.find((entry) => entry.op === 'fill')
    expect(stroke?.strokeStyle).toBe('#abcdef')
    expect(stroke?.globalAlpha).toBe(PRESENCE_GHOST_ALPHA)
    expect(fill?.fillStyle).toBe('#abcdef')
    expect(fill?.globalAlpha).toBe(PRESENCE_GHOST_FILL_ALPHA)
  })

  it('paints one ghost outline per dragged element', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithGhost([frameAt(0), frameAt(40), frameAt(80)]), camera)
    expect(ops.filter((entry) => entry.op === 'stroke')).toHaveLength(3)
  })

  it('paints nothing for a ghost that carries no frames', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithGhost([]), camera)
    expect(ops).toEqual([])
  })

  it('paints ghosts under the halo and the cursor of the same peer', () => {
    const { ctx, ops } = recorder()
    paintPresence(
      ctx,
      {
        cursors: [{ id: 'u1', point: { x: 0, y: 0 }, color: '#123456' }],
        halos: [{ id: 'u1', frame: frameAt(40), color: '#abcdef' }],
        ghosts: [{ id: 'u1', frames: [frameAt(40)], color: '#abcdef' }],
      },
      camera,
      PRESENCE_COLORS,
    )
    expect(ops.map((entry) => entry.op)).toEqual(['fill', 'stroke', 'stroke', 'fill', 'stroke'])
  })

  it('rotates the ghost outline with the element it shadows', () => {
    const points: Array<{ x: number; y: number }> = []
    const { ctx } = recorder()
    const spy = { ...ctx, lineTo: (x: number, y: number) => points.push({ x, y }) }
    paintPresence(
      spy as unknown as CanvasRenderingContext2D,
      overlayWithGhost([frameAt(0, Math.PI / 2)]),
      camera,
    )
    expect(points[0]?.x).toBeCloseTo(10)
    expect(points[0]?.y).toBeCloseTo(10)
  })
})
