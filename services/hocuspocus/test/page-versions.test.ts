import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  applyDocumentState,
  foldPageState,
  restorePageState,
  type DirectDocumentConnection,
  type DocumentGateway,
} from '../src/page-versions.js'
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

function readDoc(state: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, state)
  return doc
}

function scene(doc: Y.Doc): { elements: Record<string, unknown>; order: unknown[]; appState: Record<string, unknown> } {
  return {
    elements: doc.getMap('elements').toJSON() as Record<string, unknown>,
    order: doc.getArray('elementOrder').toArray(),
    appState: doc.getMap('appState').toJSON() as Record<string, unknown>,
  }
}

function seedScene(doc: Y.Doc): void {
  doc.transact(() => {
    doc.getMap('elements').set('a', element({ id: 'a', type: 'rect', x: 1, y: 2, style: { fill: 'red' } }))
    doc.getArray('elementOrder').insert(0, ['a'])
    doc.getMap('appState').set('schemaVersion', 5)
  })
}

class FakeDirectConnection implements DirectDocumentConnection {
  public disconnects = 0

  constructor(private readonly document: Y.Doc) {}

  async transact(transaction: (document: Y.Doc) => void): Promise<void> {
    this.document.transact(() => transaction(this.document), { source: 'local' })
  }

  async disconnect(): Promise<void> {
    this.disconnects += 1
  }
}

class FakeGateway implements DocumentGateway {
  public readonly rooms: string[] = []
  public readonly connection: FakeDirectConnection

  constructor(public readonly document: Y.Doc) {
    this.connection = new FakeDirectConnection(document)
  }

  async openDirectConnection(documentName: string): Promise<DirectDocumentConnection> {
    this.rooms.push(documentName)
    return this.connection
  }
}

describe('foldPageState', () => {
  it('merges the head snapshot with the pending update tail', async () => {
    const source = new Y.Doc()
    seedScene(source)
    const snapshotState = encodeDocState(source)

    const tail = captureUpdate(source, () =>
      source.getMap('elements').set('b', element({ id: 'b', type: 'ellipse' })),
    )

    const store = new FakePageStore({ room: ROOM })
    store.seedSnapshot(snapshotState, 5)
    store.seedUpdateAtSeq(6, tail)

    const folded = await foldPageState(store, 1, null)

    expect(folded).not.toBeNull()
    expect(folded!.upToSeq).toBe(6)

    const merged = readDoc(folded!.state)
    expect(Object.keys(merged.getMap('elements').toJSON())).toEqual(['a', 'b'])
  })

  it('keeps the snapshot boundary when every update was already pruned', async () => {
    const source = new Y.Doc()
    seedScene(source)

    const store = new FakePageStore({ room: ROOM })
    store.seedSnapshot(encodeDocState(source), 42)

    const folded = await foldPageState(store, 1, null)

    expect(folded!.upToSeq).toBe(42)
    expect(readDoc(folded!.state).getMap('elements').has('a')).toBe(true)
  })

  it('folds from the bridge column when no snapshot exists yet', async () => {
    const source = new Y.Doc()
    seedScene(source)

    const store = new FakePageStore({ room: ROOM, document: bytesToBase64(encodeDocState(source)) })
    const tail = captureUpdate(source, () =>
      source.getMap('elements').set('c', element({ id: 'c', type: 'line' })),
    )
    store.seedUpdateAtSeq(1, tail)

    const folded = await foldPageState(store, 1, store.document)

    expect(folded!.upToSeq).toBe(1)

    const merged = readDoc(folded!.state)
    expect(merged.getMap('elements').has('a')).toBe(true)
    expect(merged.getMap('elements').has('c')).toBe(true)
  })

  it('returns null when there is nothing to fold', async () => {
    const store = new FakePageStore({ room: ROOM })

    expect(await foldPageState(store, 1, null)).toBeNull()
  })

  it('retries when a compaction lands between reading the snapshot and the tail', async () => {
    const source = new Y.Doc()
    seedScene(source)
    const first = encodeDocState(source)
    const tail = captureUpdate(source, () =>
      source.getMap('elements').set('b', element({ id: 'b', type: 'ellipse' })),
    )

    const store = new FakePageStore({ room: ROOM })
    store.seedSnapshot(first, 5)
    store.seedUpdateAtSeq(6, tail)

    let reads = 0
    const originalUpdatesAfter = store.updatesAfter.bind(store)
    store.updatesAfter = async (pageId: number, afterSeq: number): Promise<Uint8Array[]> => {
      const rows = await originalUpdatesAfter(pageId, afterSeq)
      reads += 1

      if (reads === 1) {
        store.seedSnapshot(encodeDocState(source), 6)
        await store.pruneUpdatesUpTo(pageId, 6)
      }

      return rows
    }

    const folded = await foldPageState(store, 1, null)

    expect(reads).toBe(2)
    expect(folded!.upToSeq).toBe(6)
    expect(readDoc(folded!.state).getMap('elements').has('b')).toBe(true)
  })
})

describe('applyDocumentState', () => {
  it('is not the same as replaying the old state onto the live document', () => {
    const version = new Y.Doc()
    seedScene(version)
    const versionState = encodeDocState(version)

    const live = readDoc(versionState)
    live.getMap('elements').set('b', element({ id: 'b', type: 'ellipse' }))

    Y.applyUpdate(live, versionState)

    expect(live.getMap('elements').has('b')).toBe(true)

    applyDocumentState(live, readDoc(versionState))

    expect(live.getMap('elements').has('b')).toBe(false)
  })

  it('removes later elements, revives deleted ones and reverts changed fields', () => {
    const version = new Y.Doc()
    seedScene(version)
    version.getMap('elements').set('gone', element({ id: 'gone', type: 'text', x: 9 }))
    version.getArray('elementOrder').delete(0, version.getArray('elementOrder').length)
    version.getArray('elementOrder').insert(0, ['a', 'gone'])
    const versionState = encodeDocState(version)

    const live = readDoc(versionState)
    live.transact(() => {
      live.getMap('elements').delete('gone')
      live.getMap('elements').set('later', element({ id: 'later', type: 'line' }))
      const a = live.getMap('elements').get('a') as Y.Map<unknown>
      a.set('x', 999)
      a.set('extra', true)
      a.delete('style')
      live.getArray('elementOrder').delete(0, live.getArray('elementOrder').length)
      live.getArray('elementOrder').insert(0, ['later', 'a'])
      live.getMap('appState').set('schemaVersion', 6)
      live.getMap('appState').set('slides', [{ id: 's1' }])
    })

    applyDocumentState(live, readDoc(versionState))

    expect(scene(live)).toEqual(scene(readDoc(versionState)))
  })

  it('leaves an already matching document untouched', () => {
    const version = new Y.Doc()
    seedScene(version)
    const versionState = encodeDocState(version)

    const live = readDoc(versionState)
    let updates = 0
    live.on('update', () => {
      updates += 1
    })

    live.transact(() => applyDocumentState(live, readDoc(versionState)))

    expect(updates).toBe(0)
  })
})

describe('restorePageState', () => {
  it('applies the version content to the live document in a single transaction', async () => {
    const version = new Y.Doc()
    seedScene(version)
    const versionState = encodeDocState(version)

    const live = readDoc(versionState)
    live.getMap('elements').set('later', element({ id: 'later', type: 'line' }))

    let updates = 0
    live.on('update', () => {
      updates += 1
    })

    const store = new FakePageStore({ room: ROOM })
    store.seedUpdateAtSeq(7, new Uint8Array([1]))

    const gateway = new FakeGateway(live)
    const restored = await restorePageState(gateway, store, ROOM, 1, versionState)

    expect(gateway.rooms).toEqual([ROOM])
    expect(gateway.connection.disconnects).toBe(1)
    expect(updates).toBe(1)
    expect(restored.upToSeq).toBe(7)
    expect(live.getMap('elements').has('later')).toBe(false)
    expect(scene(readDoc(restored.state))).toEqual(scene(readDoc(versionState)))
  })

  it('disconnects even when the transform throws', async () => {
    const live = new Y.Doc()
    const gateway = new FakeGateway(live)
    gateway.connection.transact = async (): Promise<void> => {
      throw new Error('boom')
    }

    const store = new FakePageStore({ room: ROOM })

    await expect(restorePageState(gateway, store, ROOM, 1, encodeDocState(new Y.Doc()))).rejects.toThrow('boom')
    expect(gateway.connection.disconnects).toBe(1)
  })
})
