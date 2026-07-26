import { describe, expect, it } from 'vitest'
import * as engine from './index.js'
import { setSvgFontFaces } from './render/draw-target.js'

describe('engine barrel', () => {
  it('exposes the svg font-face registry the app chrome fills in', () => {
    expect(engine.setSvgFontFaces).toBe(setSvgFontFaces)
  })

  it('types an svg font face and an image href resolver for consumers', () => {
    const face: engine.SvgFontFace = {
      family: 'Architects Daughter',
      source: 'data:font/woff2;base64,FONT',
      weight: 400,
      style: 'normal',
    }
    const resolve: engine.ImageHrefResolver = () => face.source

    expect(resolve()).toBe('data:font/woff2;base64,FONT')
  })
})
