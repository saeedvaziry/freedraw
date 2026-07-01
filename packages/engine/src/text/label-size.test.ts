import { describe, expect, it } from 'vitest'
import { defaultStyle } from '../model/schema.js'
import { labelRect } from '../geometry/shape-outline.js'
import { measureTextBox } from './size.js'
import { fitShapeToLabel, labelContentSize } from './label-size.js'

const bounds = { x: 0, y: 0, width: 120, height: 80 }

describe('fitShapeToLabel', () => {
  it('returns null when the shape already fits the text', () => {
    expect(fitShapeToLabel('rect', bounds, 'hi', defaultStyle)).toBeNull()
  })

  it('grows the shape to contain a long single line', () => {
    const long = 'a very long label that will not fit inside the default box'
    const next = fitShapeToLabel('rect', bounds, long, defaultStyle)
    expect(next).not.toBeNull()
    const content = labelContentSize('rect', long, defaultStyle)
    expect(next!.width).toBeGreaterThanOrEqual(content.width)
    expect(next!.width).toBeGreaterThan(bounds.width)
  })

  it('grows the height for multi-line labels', () => {
    const next = fitShapeToLabel('rect', bounds, 'one\ntwo\nthree\nfour', defaultStyle)
    expect(next).not.toBeNull()
    expect(next!.height).toBeGreaterThan(bounds.height)
  })

  it('never shrinks below the current bounds', () => {
    const wide = { x: 0, y: 0, width: 500, height: 400 }
    expect(fitShapeToLabel('rect', wide, 'tiny', defaultStyle)).toBeNull()
  })

  it('keeps the shape centered while growing', () => {
    const long = 'a label long enough to force the box to expand outward'
    const start = { x: 100, y: 100, width: 120, height: 80 }
    const next = fitShapeToLabel('rect', start, long, defaultStyle)!
    expect(next.x + next.width / 2).toBeCloseTo(start.x + start.width / 2)
    expect(next.y + next.height / 2).toBeCloseTo(start.y + start.height / 2)
  })

  it('returns the floor unchanged for empty text so clearing resets', () => {
    const floor = { x: 0, y: 0, width: 120, height: 80 }
    expect(fitShapeToLabel('rect', floor, '', defaultStyle)).toBeNull()
  })

  it('round-trips: growing then clearing from the floor returns the floor', () => {
    const floor = { x: 50, y: 50, width: 120, height: 80 }
    const grown = fitShapeToLabel('rect', floor, 'a long label forcing growth', defaultStyle)!
    expect(grown.width).toBeGreaterThan(floor.width)
    const cleared = fitShapeToLabel('rect', floor, '', defaultStyle)
    expect(cleared).toBeNull()
  })

  it('inflates non-rectangular shapes more than rectangles', () => {
    const text = 'label that needs space'
    const rect = labelContentSize('rect', text, defaultStyle)
    const diamond = labelContentSize('diamond', text, defaultStyle)
    expect(diamond.width).toBeGreaterThan(rect.width)
    expect(diamond.height).toBeGreaterThan(rect.height)
  })

  it('pads content on both axes', () => {
    const text = 'label'
    const measured = measureTextBox(text, defaultStyle)
    const content = labelContentSize('rect', text, defaultStyle)
    expect(content.width).toBeGreaterThan(measured.width)
    expect(content.height).toBeGreaterThan(measured.height)
  })

  it('reserves the cylinder cap at the grown size, not the floor', () => {
    const floor = { x: 0, y: 0, width: 100, height: 120 }
    const text = 'one\ntwo\nthree\nfour\nfive\nsix'
    const grown = fitShapeToLabel('cylinder', floor, text, defaultStyle)!
    const content = labelContentSize('cylinder', text, defaultStyle)
    const usable = labelRect('cylinder', grown)
    expect(usable.height).toBeGreaterThanOrEqual(content.height)
  })
})
