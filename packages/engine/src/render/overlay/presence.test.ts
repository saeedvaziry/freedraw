import { describe, expect, it } from 'vitest'
import { Camera } from '../../geometry/camera.js'
import type { SelectionFrame } from '../../geometry/handles.js'
import { PRESENCE_COLORS, type PresenceColors } from '../color-config.js'
import {
  paintPresence,
  PRESENCE_GHOST_ALPHA,
  PRESENCE_GHOST_FILL_ALPHA,
  PRESENCE_LASER_CORE_ALPHA,
  PRESENCE_LASER_CORE_WIDTH,
  PRESENCE_LASER_GLOW_ALPHA,
  PRESENCE_LASER_GLOW_WIDTH,
  PRESENCE_LASER_TAIL_SCALE,
  PRESENCE_PREVIEW_ALPHA,
  PRESENCE_PREVIEW_DASH,
  type PresenceLaser,
  type PresenceOverlay,
} from './presence.js'

interface RecordedOp {
  op: string
  fillStyle: string
  strokeStyle: string
  globalAlpha: number
  lineDash: number[]
  lineWidth: number
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
      lineWidth: ctx.lineWidth,
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
    lineCap: 'butt',
    lineJoin: 'miter',
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
    arc: noop,
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
    const colors: PresenceColors = {
      cursorOutline: '#00ff00',
      cursorLabelText: '#ff00ff',
      laserCore: '#eeeeee',
    }
    paintPresence(ctx, overlayWithCursor(), camera, colors)
    const stroke = ops.find((entry) => entry.op === 'stroke')
    expect(stroke?.strokeStyle).toBe('#00ff00')
  })

  it('draws the label text with the supplied presence label color', () => {
    const { ctx, ops } = recorder()
    const colors: PresenceColors = {
      cursorOutline: '#00ff00',
      cursorLabelText: '#ff00ff',
      laserCore: '#eeeeee',
    }
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

function laser(overrides: Partial<PresenceLaser> = {}): PresenceLaser {
  return {
    id: 'u1',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ],
    color: '#ff2255',
    ...overrides,
  }
}

function overlayWithLaser(overrides: Partial<PresenceLaser> = {}): PresenceOverlay {
  return { cursors: [], halos: [], ghosts: [], lasers: [laser(overrides)] }
}

describe('paintPresence lasers', () => {
  it('strokes a glow pass and a core pass per trail segment', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithLaser(), camera, PRESENCE_COLORS)
    const strokes = ops.filter((entry) => entry.op === 'stroke')
    expect(strokes).toHaveLength(4)
    expect(strokes.every((entry) => entry.strokeStyle === '#ff2255')).toBe(true)
  })

  it('tapers width and opacity from the head back to the tail', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithLaser(), camera, PRESENCE_COLORS)
    const strokes = ops.filter((entry) => entry.op === 'stroke')
    const taper = PRESENCE_LASER_TAIL_SCALE + (1 - PRESENCE_LASER_TAIL_SCALE) * 0.5
    expect(strokes[0]?.globalAlpha).toBeCloseTo(PRESENCE_LASER_GLOW_ALPHA * taper)
    expect(strokes[0]?.lineWidth).toBeCloseTo(PRESENCE_LASER_GLOW_WIDTH * taper)
    expect(strokes[1]?.globalAlpha).toBeCloseTo(PRESENCE_LASER_GLOW_ALPHA)
    expect(strokes[1]?.lineWidth).toBeCloseTo(PRESENCE_LASER_GLOW_WIDTH)
  })

  it('keeps the core pass tighter and brighter than the glow', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithLaser(), camera, PRESENCE_COLORS)
    const core = ops.filter((entry) => entry.op === 'stroke')[3]
    expect(core?.globalAlpha).toBeCloseTo(PRESENCE_LASER_CORE_ALPHA)
    expect(core?.lineWidth).toBeCloseTo(PRESENCE_LASER_CORE_WIDTH)
  })

  it('scales the whole trail by the fade alpha', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithLaser({ alpha: 0.5 }), camera, PRESENCE_COLORS)
    const head = ops.filter((entry) => entry.op === 'stroke')[1]
    expect(head?.globalAlpha).toBeCloseTo(PRESENCE_LASER_GLOW_ALPHA * 0.5)
  })

  it('paints nothing for a trail that has faded out', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithLaser({ alpha: 0 }), camera, PRESENCE_COLORS)
    expect(ops).toEqual([])
  })

  it('paints nothing for an empty trail', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithLaser({ points: [] }), camera, PRESENCE_COLORS)
    expect(ops).toEqual([])
  })

  it('paints a resting pointer as a head dot with no segments', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, overlayWithLaser({ points: [{ x: 4, y: 4 }] }), camera, PRESENCE_COLORS)
    expect(ops.map((entry) => entry.op)).toEqual(['fill', 'fill'])
  })

  it('caps the head with the peer color and the shared laser core', () => {
    const { ctx, ops } = recorder()
    const colors: PresenceColors = {
      cursorOutline: '#00ff00',
      cursorLabelText: '#ff00ff',
      laserCore: '#eeeeee',
    }
    paintPresence(ctx, overlayWithLaser(), camera, colors)
    const fills = ops.filter((entry) => entry.op === 'fill')
    expect(fills.map((entry) => entry.fillStyle)).toEqual(['#ff2255', '#eeeeee'])
  })

  it('centers the head dot on the newest point in screen space', () => {
    const centers: Array<{ x: number; y: number }> = []
    const { ctx } = recorder()
    const spy = { ...ctx, arc: (x: number, y: number) => centers.push({ x, y }) }
    paintPresence(
      spy as unknown as CanvasRenderingContext2D,
      overlayWithLaser(),
      new Camera({ x: 0, y: 0, zoom: 2 }),
    )
    expect(centers[0]).toEqual({ x: 40, y: 0 })
  })

  it('paints trails above halos and below the cursor of the same peer', () => {
    const { ctx, ops } = recorder()
    paintPresence(
      ctx,
      {
        cursors: [{ id: 'u1', point: { x: 0, y: 0 }, color: '#123456' }],
        halos: [{ id: 'u1', frame: frameAt(40), color: '#abcdef' }],
        ghosts: [],
        lasers: [laser({ points: [{ x: 0, y: 0 }] })],
      },
      camera,
      PRESENCE_COLORS,
    )
    expect(ops.map((entry) => entry.op)).toEqual(['stroke', 'fill', 'fill', 'fill', 'stroke'])
  })

  it('leaves overlays that carry no laser field untouched', () => {
    const { ctx, ops } = recorder()
    paintPresence(ctx, { cursors: [], halos: [], ghosts: [] }, camera, PRESENCE_COLORS)
    expect(ops).toEqual([])
  })
})
