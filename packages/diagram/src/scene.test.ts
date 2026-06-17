import { describe, expect, it } from 'vitest'
import type { ShapeElement } from '@freedraw/engine/model/types'
import { buildScene } from './scene.js'
import { defaultDiagramLayout, defaultDiagramStyle } from './style.js'

const SAMPLE = 'flowchart TD\nA[Start] --> B[Done]'

function shapes(scene: ReturnType<typeof buildScene>): ShapeElement[] {
  return Object.values(scene.snapshot.elements).filter(
    (element): element is ShapeElement => element.type !== 'arrow' && element.type !== 'line',
  )
}

function shapeStyles(scene: ReturnType<typeof buildScene>) {
  return shapes(scene).map((element) => element.style)
}

describe('buildScene style defaults', () => {
  it('defaults to no sloppiness and a sans-serif font', () => {
    expect(defaultDiagramStyle.sloppiness).toBe(0)
    expect(defaultDiagramStyle.fontFamily).toMatch(/sans-serif/)

    for (const style of shapeStyles(buildScene(SAMPLE))) {
      expect(style.sloppiness).toBe(0)
      expect(style.fontFamily).toBe(defaultDiagramStyle.fontFamily)
    }
  })

  it('applies sloppiness and font overrides to every shape', () => {
    const scene = buildScene(SAMPLE, {
      style: { sloppiness: 0.5, fontFamily: "'Architects Daughter', cursive" },
    })

    const styles = shapeStyles(scene)
    expect(styles.length).toBeGreaterThan(0)
    for (const style of styles) {
      expect(style.sloppiness).toBe(0.5)
      expect(style.fontFamily).toBe("'Architects Daughter', cursive")
    }
  })
})

describe('buildScene layout defaults', () => {
  it('sizes each node to its own label by default', () => {
    const widths = shapes(buildScene('flowchart TD\nA[X] --> B[A much longer label]')).map((s) => s.width)
    expect(new Set(widths).size).toBeGreaterThan(1)
  })

  it('honors the configured minimum node size', () => {
    const min = defaultDiagramLayout.minNodeSize!
    for (const shape of shapes(buildScene('flowchart TD\nA[X] --> B[Y]'))) {
      expect(shape.width).toBeGreaterThanOrEqual(min.width!)
      expect(shape.height).toBeGreaterThanOrEqual(min.height!)
    }
  })

  it('lets the sibling gap be tuned', () => {
    const siblingSpread = (scene: ReturnType<typeof buildScene>) => {
      const xs = shapes(scene).map((shape) => shape.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    const tight = siblingSpread(buildScene('flowchart TD\nA --> B\nA --> C'))
    const wide = siblingSpread(buildScene('flowchart TD\nA --> B\nA --> C', { layout: { siblingGap: 300 } }))
    expect(wide).toBeGreaterThan(tight)
  })

  it('can opt back into uniform box sizing', () => {
    const widths = shapes(
      buildScene('flowchart TD\nA[X] --> B[A much longer label]', { layout: { uniform: true } }),
    ).map((s) => s.width)
    expect(new Set(widths).size).toBe(1)
  })
})
