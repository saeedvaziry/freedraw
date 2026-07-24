import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { base64ToBytes, bytesToBase64, collectAssetIds, encodeDocState } from '../src/yjs-helpers.js'

function docWithText(): Y.Doc {
  const doc = new Y.Doc()
  doc.getMap('elements').set('a', new Y.Map(Object.entries({ type: 'rect' })))
  return doc
}

describe('yjs-helpers', () => {
  it('round-trips a document through base64 with byte-compatible encoding', () => {
    const doc = docWithText()
    const state = encodeDocState(doc)
    const base64 = bytesToBase64(state)

    expect(base64).toBe(Buffer.from(state).toString('base64'))

    const restored = new Y.Doc()
    Y.applyUpdate(restored, base64ToBytes(base64))

    expect(encodeDocState(restored)).toEqual(state)
    expect(restored.getMap('elements').has('a')).toBe(true)
  })

  it('collects asset ids only from image elements', () => {
    const doc = new Y.Doc()
    const elements = doc.getMap('elements')

    const image = new Y.Map()
    image.set('type', 'image')
    image.set('assetId', 'asset-1')
    elements.set('one', image)

    const secondImage = new Y.Map()
    secondImage.set('type', 'image')
    secondImage.set('assetId', 'asset-2')
    elements.set('two', secondImage)

    const rect = new Y.Map()
    rect.set('type', 'rect')
    elements.set('three', rect)

    const imageWithoutAsset = new Y.Map()
    imageWithoutAsset.set('type', 'image')
    elements.set('four', imageWithoutAsset)

    expect(collectAssetIds(doc).sort()).toEqual(['asset-1', 'asset-2'])
  })

  it('returns an empty list for a document with no image assets', () => {
    expect(collectAssetIds(new Y.Doc())).toEqual([])
  })
})
