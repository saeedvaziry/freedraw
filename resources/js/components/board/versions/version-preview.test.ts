import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { createShape, SceneStore, seedAppState } from '@freedraw/engine'
import { encodeDocAsBase64 } from '@/lib/persistence'
import { createVersionPreview, VersionPreviewError } from './version-preview.js'

function liveBoard(ids: string[]): { doc: Y.Doc; store: SceneStore } {
  const doc = new Y.Doc()
  seedAppState(doc)
  const store = new SceneStore(doc)
  store.transact((api) => {
    ids.forEach((id, index) => {
      api.addElement(createShape({ id, type: 'rect', x: index * 50, y: 0, width: 40, height: 40 }))
    })
  })
  return { doc, store }
}

describe('createVersionPreview', () => {
  it('rebuilds the scene captured in the encoded state', () => {
    const live = liveBoard(['a', 'b'])
    const preview = createVersionPreview(encodeDocAsBase64(live.doc))

    expect(preview.store.getSnapshot().order).toEqual(['a', 'b'])

    preview.destroy()
    live.store.destroy()
    live.doc.destroy()
  })

  it('never shares a document with the board it was decoded from', () => {
    const live = liveBoard(['a'])
    const preview = createVersionPreview(encodeDocAsBase64(live.doc))

    expect(preview.store.getSnapshot().order).toEqual(['a'])

    preview.store.transact((api) => {
      api.addElement(createShape({ id: 'ghost', type: 'rect', x: 0, y: 0, width: 10, height: 10 }))
    })
    preview.store.deleteElements(new Set(['a']))

    expect(live.store.getSnapshot().order).toEqual(['a'])
    expect(live.doc.getArray('elementOrder').toArray()).toEqual(['a'])

    preview.destroy()

    expect(live.store.getSnapshot().order).toEqual(['a'])

    live.store.destroy()
    live.doc.destroy()
  })

  it('leaves the live board untouched when it keeps editing after a preview opened', () => {
    const live = liveBoard(['a'])
    const preview = createVersionPreview(encodeDocAsBase64(live.doc))

    live.store.transact((api) => {
      api.addElement(createShape({ id: 'later', type: 'rect', x: 0, y: 0, width: 10, height: 10 }))
    })

    expect(live.store.getSnapshot().order).toEqual(['a', 'later'])
    expect(preview.store.getSnapshot().order).toEqual(['a'])

    preview.destroy()
    live.store.destroy()
    live.doc.destroy()
  })

  it('tolerates being destroyed twice', () => {
    const live = liveBoard(['a'])
    const preview = createVersionPreview(encodeDocAsBase64(live.doc))

    preview.destroy()
    expect(() => preview.destroy()).not.toThrow()

    live.store.destroy()
    live.doc.destroy()
  })

  it('rejects state that is not a readable board', () => {
    const corrupt = new Y.Doc()
    corrupt.getArray('elementOrder').push(['ok'])
    corrupt.getMap('elements').set('ok', 'not an element map')

    expect(() => createVersionPreview(encodeDocAsBase64(corrupt))).toThrow(VersionPreviewError)

    corrupt.destroy()
  })

  it('rejects state that is not decodable at all', () => {
    expect(() => createVersionPreview('!!!not base64!!!')).toThrow(VersionPreviewError)
  })
})
