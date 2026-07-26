import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { Server } from '@hocuspocus/server'
import { InternalApi } from '../src/internal-api.js'
import { UpdateLogDatabase } from '../src/update-log-database.js'
import { base64ToBytes, bytesToBase64, encodeDocState } from '../src/yjs-helpers.js'
import { FakePageStore } from './fake-page-store.js'

const ROOM = 'room-1'

const SECRET = 'internal-secret'

function element(fields: Record<string, unknown>): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [key, value] of Object.entries(fields)) {
    map.set(key, value)
  }
  return map
}

function readDoc(state: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, state)
  return doc
}

function seedScene(doc: Y.Doc): void {
  doc.transact(() => {
    doc.getMap('elements').set('a', element({ id: 'a', type: 'rect', x: 1 }))
    doc.getArray('elementOrder').insert(0, ['a'])
  })
}

const running: Server[] = []

async function start(store: FakePageStore): Promise<{ server: Server; url: string }> {
  const server = new Server({
    port: 0,
    address: '127.0.0.1',
    quiet: true,
    stopOnSignals: false,
    extensions: [new UpdateLogDatabase({ store }), new InternalApi({ store, secret: SECRET })],
  })

  await server.listen()
  running.push(server)

  return { server, url: `http://127.0.0.1:${server.address.port}` }
}

afterEach(async () => {
  while (running.length > 0) {
    await running.pop()!.destroy()
  }
})

describe('InternalApi on a running Hocuspocus server', () => {
  it('rewrites the loaded document every connected client shares', async () => {
    const version = new Y.Doc()
    seedScene(version)
    const versionState = encodeDocState(version)

    const head = readDoc(versionState)
    head.getMap('elements').set('later', element({ id: 'later', type: 'line' }))

    const store = new FakePageStore({ room: ROOM })
    store.seedSnapshot(encodeDocState(head), 3)

    const { server, url } = await start(store)
    const holder = await server.hocuspocus.openDirectConnection(ROOM)

    expect(holder.document!.getMap('elements').has('later')).toBe(true)

    const response = await fetch(`${url}/internal/pages/${ROOM}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: bytesToBase64(versionState) }),
    })

    expect(response.status).toBe(200)

    const body = (await response.json()) as { state: string; upToSeq: number }

    expect(holder.document!.getMap('elements').has('later')).toBe(false)
    expect(holder.document!.getMap('elements').has('a')).toBe(true)
    expect(readDoc(base64ToBytes(body.state)).getMap('elements').has('later')).toBe(false)

    const persisted = store.snapshots[store.snapshots.length - 1]!
    expect(readDoc(persisted.state).getMap('elements').has('later')).toBe(false)
    expect(readDoc(base64ToBytes(store.document!)).getMap('elements').has('later')).toBe(false)

    await holder.disconnect()
  })

  it('folds the pending update log for a room that is not loaded', async () => {
    const source = new Y.Doc()
    seedScene(source)
    const snapshotState = encodeDocState(source)

    let tail: Uint8Array | undefined
    source.on('update', (update: Uint8Array) => {
      tail = update
    })
    source.getMap('elements').set('b', element({ id: 'b', type: 'ellipse' }))

    const store = new FakePageStore({ room: ROOM })
    store.seedSnapshot(snapshotState, 8)
    store.seedUpdateAtSeq(9, tail!)

    const { server, url } = await start(store)

    const response = await fetch(`${url}/internal/pages/${ROOM}/fold`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: '{}',
    })

    const body = (await response.json()) as { state: string; upToSeq: number }

    expect(response.status).toBe(200)
    expect(body.upToSeq).toBe(9)
    expect(Object.keys(readDoc(base64ToBytes(body.state)).getMap('elements').toJSON())).toEqual(['a', 'b'])
    expect(server.hocuspocus.getDocumentsCount()).toBe(0)
  })
})
