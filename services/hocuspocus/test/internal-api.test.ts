import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import type { onRequestPayload } from '@hocuspocus/server'
import { InternalApi, matchInternalRoute, secretMatches } from '../src/internal-api.js'
import type { DirectDocumentConnection, DocumentGateway } from '../src/page-versions.js'
import { base64ToBytes, encodeDocState } from '../src/yjs-helpers.js'
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

class FakeGateway implements DocumentGateway {
  public disconnects = 0

  constructor(public readonly document: Y.Doc) {}

  async openDirectConnection(): Promise<DirectDocumentConnection> {
    return {
      transact: async (transaction: (document: Y.Doc) => void): Promise<void> => {
        this.document.transact(() => transaction(this.document), { source: 'local' })
      },
      disconnect: async (): Promise<void> => {
        this.disconnects += 1
      },
    }
  }
}

interface Harness {
  url: string
  server: Server
}

const started: Server[] = []

async function serve(api: InternalApi, gateway: DocumentGateway): Promise<Harness> {
  const server = createServer((request, response) => {
    void (async () => {
      try {
        await api.onRequest({ request, response, instance: gateway } as unknown as onRequestPayload)
        response.writeHead(200, { 'Content-Type': 'text/plain' })
        response.end('Welcome to Hocuspocus!')
      } catch (error) {
        if (error) {
          throw error
        }
      }
    })()
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  started.push(server)

  const address = server.address() as AddressInfo

  return { server, url: `http://127.0.0.1:${address.port}` }
}

afterEach(async () => {
  while (started.length > 0) {
    const server = started.pop()!
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

function post(url: string, body?: unknown, token: string | null = SECRET): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('matchInternalRoute', () => {
  it('matches the fold and restore operations', () => {
    expect(matchInternalRoute('/internal/pages/abc/fold')).toEqual({ room: 'abc', operation: 'fold' })
    expect(matchInternalRoute('/internal/pages/abc/restore?x=1')).toEqual({
      room: 'abc',
      operation: 'restore',
    })
  })

  it('ignores everything else', () => {
    expect(matchInternalRoute('/')).toBeNull()
    expect(matchInternalRoute('/internal/pages/abc')).toBeNull()
    expect(matchInternalRoute('/internal/pages/abc/delete')).toBeNull()
    expect(matchInternalRoute('/internal/pages//fold')).toBeNull()
  })
})

describe('secretMatches', () => {
  it('rejects an empty configured secret', () => {
    expect(secretMatches('', '')).toBe(false)
    expect(secretMatches('anything', '')).toBe(false)
  })

  it('compares secrets of different lengths without throwing', () => {
    expect(secretMatches('short', 'a-much-longer-secret')).toBe(false)
    expect(secretMatches('same', 'same')).toBe(true)
  })
})

describe('InternalApi routing', () => {
  it('passes unrelated requests through to the default handler', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const response = await fetch(`${url}/`)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('Welcome to Hocuspocus!')
  })

  it('rejects a missing or wrong bearer token', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const missing = await post(`${url}/internal/pages/${ROOM}/fold`, {}, null)
    const wrong = await post(`${url}/internal/pages/${ROOM}/fold`, {}, 'nope')

    expect(missing.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(await wrong.json()).toEqual({ error: 'unauthorized' })
  })

  it('rejects a non-POST method', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const response = await fetch(`${url}/internal/pages/${ROOM}/fold`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })

    expect(response.status).toBe(405)
  })

  it('reports an unknown room', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const response = await post(`${url}/internal/pages/other-room/fold`, {})

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'unknown room' })
  })
})

describe('InternalApi fold', () => {
  it('returns the merged head state and boundary', async () => {
    const source = new Y.Doc()
    seedScene(source)

    const store = new FakePageStore({ room: ROOM })
    store.seedSnapshot(encodeDocState(source), 4)

    let tail: Uint8Array | undefined
    source.on('update', (update: Uint8Array) => {
      tail = update
    })
    source.getMap('elements').set('b', element({ id: 'b', type: 'ellipse' }))
    store.seedUpdateAtSeq(5, tail!)

    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const response = await post(`${url}/internal/pages/${ROOM}/fold`, {})
    const body = (await response.json()) as { state: string; upToSeq: number }

    expect(response.status).toBe(200)
    expect(body.upToSeq).toBe(5)

    const merged = readDoc(base64ToBytes(body.state))
    expect(Object.keys(merged.getMap('elements').toJSON())).toEqual(['a', 'b'])
  })

  it('reports when there is nothing to fold', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const response = await post(`${url}/internal/pages/${ROOM}/fold`, {})

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'nothing to fold' })
  })
})

describe('InternalApi restore', () => {
  it('applies the posted state to the live document', async () => {
    const version = new Y.Doc()
    seedScene(version)
    const versionState = encodeDocState(version)

    const live = readDoc(versionState)
    live.getMap('elements').set('later', element({ id: 'later', type: 'line' }))

    const store = new FakePageStore({ room: ROOM })
    store.seedUpdateAtSeq(11, new Uint8Array([1]))

    const gateway = new FakeGateway(live)
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), gateway)

    const response = await post(`${url}/internal/pages/${ROOM}/restore`, {
      state: Buffer.from(versionState).toString('base64'),
    })
    const body = (await response.json()) as { state: string; upToSeq: number }

    expect(response.status).toBe(200)
    expect(body.upToSeq).toBe(11)
    expect(gateway.disconnects).toBe(1)
    expect(live.getMap('elements').has('later')).toBe(false)
    expect(readDoc(base64ToBytes(body.state)).getMap('elements').has('a')).toBe(true)
  })

  it('requires a base64 state', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const response = await post(`${url}/internal/pages/${ROOM}/restore`, { state: '' })

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'a base64 state is required' })
  })

  it('rejects a malformed json body', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(new InternalApi({ store, secret: SECRET }), new FakeGateway(new Y.Doc()))

    const response = await fetch(`${url}/internal/pages/${ROOM}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: '{not json',
    })

    expect(response.status).toBe(400)
  })

  it('rejects a body above the configured limit', async () => {
    const store = new FakePageStore({ room: ROOM })
    const { url } = await serve(
      new InternalApi({ store, secret: SECRET, maxBodyBytes: 8 }),
      new FakeGateway(new Y.Doc()),
    )

    const response = await post(`${url}/internal/pages/${ROOM}/restore`, { state: 'a'.repeat(64) })

    expect(response.status).toBe(413)
  })
})
