import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import type {
  onChangePayload,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server'
import { UpdateLogDatabase } from '../src/update-log-database.js'
import { bytesToBase64, encodeDocState } from '../src/yjs-helpers.js'
import { FakePageStore } from './fake-page-store.js'

const ROOM = 'room-1'

function element(fields: Record<string, unknown>): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [key, value] of Object.entries(fields)) {
    map.set(key, value)
  }
  return map
}

function captureUpdate(doc: Y.Doc, mutate: () => void): Uint8Array {
  let captured: Uint8Array | undefined
  const handler = (update: Uint8Array): void => {
    captured = update
  }
  doc.on('update', handler)
  mutate()
  doc.off('update', handler)

  if (!captured) {
    throw new Error('expected an update to be produced')
  }

  return captured
}

function loadPayload(document: Y.Doc, documentName = ROOM): onLoadDocumentPayload {
  return { document, documentName } as unknown as onLoadDocumentPayload
}

function changePayload(
  document: Y.Doc,
  update: Uint8Array,
  transactionOrigin: unknown,
  documentName = ROOM,
): onChangePayload {
  return { document, documentName, update, transactionOrigin } as unknown as onChangePayload
}

function storePayload(document: Y.Doc, documentName = ROOM): onStoreDocumentPayload {
  return { document, documentName } as unknown as onStoreDocumentPayload
}

describe('UpdateLogDatabase.onLoadDocument', () => {
  it('applies the latest snapshot and replays the tail of updates', async () => {
    const source = new Y.Doc()
    source.getMap('elements').set('A', element({ type: 'rect' }))
    const snapshotState = encodeDocState(source)

    const tail = captureUpdate(source, () => source.getMap('elements').set('B', element({ type: 'ellipse' })))

    const store = new FakePageStore({ room: ROOM })
    store.seedSnapshot(snapshotState, 5)
    store.seedUpdateAtSeq(6, tail)

    const doc = new Y.Doc()
    await new UpdateLogDatabase({ store }).onLoadDocument(loadPayload(doc))

    expect(doc.getMap('elements').has('A')).toBe(true)
    expect(doc.getMap('elements').has('B')).toBe(true)
  })

  it('replays every update when no snapshot exists', async () => {
    const source = new Y.Doc()
    const first = captureUpdate(source, () => source.getMap('elements').set('A', element({ type: 'rect' })))
    const second = captureUpdate(source, () => source.getMap('elements').set('B', element({ type: 'line' })))

    const store = new FakePageStore({ room: ROOM })
    store.seedUpdateAtSeq(1, first)
    store.seedUpdateAtSeq(2, second)

    const doc = new Y.Doc()
    await new UpdateLogDatabase({ store }).onLoadDocument(loadPayload(doc))

    expect(doc.getMap('elements').has('A')).toBe(true)
    expect(doc.getMap('elements').has('B')).toBe(true)
  })

  it('seeds a snapshot0 from the bridge column so the log becomes authoritative', async () => {
    const source = new Y.Doc()
    source.getMap('elements').set('Z', element({ type: 'text' }))
    const bridge = bytesToBase64(encodeDocState(source))

    const store = new FakePageStore({ room: ROOM, document: bridge })

    const doc = new Y.Doc()
    await new UpdateLogDatabase({ store }).onLoadDocument(loadPayload(doc))

    expect(doc.getMap('elements').has('Z')).toBe(true)
    expect(store.snapshots).toHaveLength(1)
    expect(store.snapshots[0]!.upToSeq).toBe(0)

    const reloaded = new Y.Doc()
    await new UpdateLogDatabase({ store }).onLoadDocument(loadPayload(reloaded))

    expect(reloaded.getMap('elements').has('Z')).toBe(true)
  })

  it('reconstructs losslessly when updates were logged before the first compaction', async () => {
    const source = new Y.Doc()
    source.getMap('elements').set('A', element({ type: 'rect' }))
    const bridge = bytesToBase64(encodeDocState(source))
    const delta = captureUpdate(source, () => source.getMap('elements').set('B', element({ type: 'ellipse' })))

    const store = new FakePageStore({ room: ROOM, document: bridge })
    store.seedUpdateAtSeq(1, delta)

    const doc = new Y.Doc()
    await new UpdateLogDatabase({ store }).onLoadDocument(loadPayload(doc))

    expect(doc.getMap('elements').has('A')).toBe(true)
    expect(doc.getMap('elements').has('B')).toBe(true)
    expect(store.snapshots).toHaveLength(1)
    expect(store.snapshots[0]!.upToSeq).toBe(0)
  })

  it('leaves the document untouched when the page is unknown', async () => {
    const store = new FakePageStore({ room: ROOM })

    const doc = new Y.Doc()
    await new UpdateLogDatabase({ store }).onLoadDocument(loadPayload(doc, 'missing-room'))

    expect(doc.getMap('elements').size).toBe(0)
  })
})

describe('UpdateLogDatabase.onChange', () => {
  it('appends the incoming update with a string origin', async () => {
    const store = new FakePageStore({ room: ROOM })
    const doc = new Y.Doc()
    const update = captureUpdate(doc, () => doc.getMap('elements').set('A', element({ type: 'rect' })))

    await new UpdateLogDatabase({ store }).onChange(changePayload(doc, update, 'connection-7'))

    expect(store.updates).toHaveLength(1)
    expect(store.updates[0]!.seq).toBe(1)
    expect(store.updates[0]!.origin).toBe('connection-7')
    expect(store.updates[0]!.update).toEqual(update)
  })

  it('records a null origin when the transaction origin is not a string', async () => {
    const store = new FakePageStore({ room: ROOM })
    const doc = new Y.Doc()
    const update = captureUpdate(doc, () => doc.getMap('elements').set('A', element({ type: 'rect' })))

    await new UpdateLogDatabase({ store }).onChange(changePayload(doc, update, { some: 'object' }))

    expect(store.updates[0]!.origin).toBeNull()
  })

  it('ignores changes for an unknown page', async () => {
    const store = new FakePageStore({ room: ROOM })
    const doc = new Y.Doc()
    const update = captureUpdate(doc, () => doc.getMap('elements').set('A', element({ type: 'rect' })))

    await new UpdateLogDatabase({ store }).onChange(changePayload(doc, update, null, 'other-room'))

    expect(store.updates).toHaveLength(0)
  })
})

describe('UpdateLogDatabase.onStoreDocument', () => {
  it('compacts to a snapshot and prunes only superseded updates', async () => {
    const store = new FakePageStore({ room: ROOM })
    store.seedUpdateAtSeq(1, new Uint8Array([1]))
    store.seedUpdateAtSeq(2, new Uint8Array([2]))

    const live = new Y.Doc()
    live.getMap('elements').set('A', element({ type: 'rect' }))
    live.getMap('elements').set('B', element({ type: 'ellipse' }))

    const concurrent = captureUpdate(live, () => live.getMap('elements').set('C', element({ type: 'line' })))

    const originalMaxSeq = store.maxSeq.bind(store)
    store.maxSeq = async (pageId: number): Promise<number> => {
      const boundary = await originalMaxSeq(pageId)
      store.seedUpdateAtSeq(3, concurrent)
      return boundary
    }

    await new UpdateLogDatabase({ store }).onStoreDocument(storePayload(live))

    expect(store.snapshots).toHaveLength(1)
    expect(store.snapshots[0]!.upToSeq).toBe(2)
    expect(store.updates.map((row) => row.seq)).toEqual([3])
    expect(store.document).toBe(bytesToBase64(encodeDocState(live)))

    const reloaded = new Y.Doc()
    await new UpdateLogDatabase({ store }).onLoadDocument(loadPayload(reloaded))

    expect(reloaded.getMap('elements').has('A')).toBe(true)
    expect(reloaded.getMap('elements').has('B')).toBe(true)
    expect(reloaded.getMap('elements').has('C')).toBe(true)
  })

  it('stamps referenced image assets', async () => {
    const store = new FakePageStore({ room: ROOM })

    const live = new Y.Doc()
    live.getMap('elements').set('img', element({ type: 'image', assetId: 'asset-42' }))
    live.getMap('elements').set('rect', element({ type: 'rect' }))

    await new UpdateLogDatabase({ store }).onStoreDocument(storePayload(live))

    expect(store.assetStamps).toEqual([{ pageId: 1, assetIds: ['asset-42'] }])
  })

  it('does not stamp assets when disabled', async () => {
    const store = new FakePageStore({ room: ROOM })

    const live = new Y.Doc()
    live.getMap('elements').set('img', element({ type: 'image', assetId: 'asset-42' }))

    await new UpdateLogDatabase({ store, stampAssetReferences: false }).onStoreDocument(storePayload(live))

    expect(store.assetStamps).toHaveLength(0)
  })

  it('prunes prior auto snapshots but keeps labeled ones', async () => {
    const store = new FakePageStore({ room: ROOM })
    const autoId = store.seedSnapshot(new Uint8Array([1]), 1, null, null)
    const labeledId = store.seedSnapshot(new Uint8Array([2]), 1, 'named version', 9)
    store.seedUpdateAtSeq(4, new Uint8Array([4]))

    const live = new Y.Doc()
    live.getMap('elements').set('A', element({ type: 'rect' }))

    await new UpdateLogDatabase({ store }).onStoreDocument(storePayload(live))

    const remainingIds = store.snapshots.map((row) => row.id)
    expect(remainingIds).not.toContain(autoId)
    expect(remainingIds).toContain(labeledId)
  })
})
