import { describe, expect, it } from 'vitest'
import { pointsBounds } from '@freedraw/engine/model/factory'
import type { ArrowElement } from '@freedraw/engine/model/types'
import { buildScene } from './scene.js'

function firstArrow(scene: ReturnType<typeof buildScene>): ArrowElement {
  const arrow = Object.values(scene.snapshot.elements).find(
    (element): element is ArrowElement => element.type === 'arrow' || element.type === 'line',
  )
  if (!arrow) throw new Error('no arrow in scene')
  return arrow
}

describe('buildScene arrow resolution', () => {
  it('gives bound arrows an orthogonal route distinct from the raw diagonal points', () => {
    const scene = buildScene('flowchart LR\nA[Left] --> B[Right]')
    expect(scene.errors).toHaveLength(0)

    const arrow = firstArrow(scene)
    expect(arrow.route.length).toBeGreaterThanOrEqual(2)
    expect(arrow.route).not.toEqual(arrow.points)
  })

  it('recomputes the arrow bounding box from its resolved route', () => {
    const scene = buildScene('flowchart TD\nA[Top] --> B[Bottom]')
    const arrow = firstArrow(scene)
    const bounds = pointsBounds(arrow.route)

    expect(arrow.x).toBeCloseTo(bounds.x)
    expect(arrow.y).toBeCloseTo(bounds.y)
    expect(arrow.width).toBeCloseTo(bounds.width)
    expect(arrow.height).toBeCloseTo(bounds.height)
  })

  it('reports parse errors and produces an empty snapshot', () => {
    const scene = buildScene('not a flowchart')
    expect(scene.errors.length).toBeGreaterThan(0)
    expect(scene.snapshot.order).toHaveLength(0)
  })
})
