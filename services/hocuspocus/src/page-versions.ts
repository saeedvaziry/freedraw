import * as Y from 'yjs'
import type { PageStore } from './page-store.js'
import { base64ToBytes, encodeDocState } from './yjs-helpers.js'

export const ELEMENTS_KEY = 'elements'

export const ELEMENT_ORDER_KEY = 'elementOrder'

export const APP_STATE_KEY = 'appState'

export interface DocumentState {
  state: Uint8Array
  upToSeq: number
}

export interface DirectDocumentConnection {
  transact(transaction: (document: Y.Doc) => void): Promise<void>
  disconnect(): Promise<void>
}

export interface DocumentGateway {
  openDirectConnection(documentName: string): Promise<DirectDocumentConnection>
}

const DEFAULT_FOLD_ATTEMPTS = 3

function toPlain(value: unknown): unknown {
  if (value instanceof Y.Map || value instanceof Y.Array || value instanceof Y.Text) {
    return value.toJSON()
  }

  return value
}

function isEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => isEqual(item, right[index]))
    )
  }

  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
    return false
  }

  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)

  if (keys.length !== Object.keys(b).length) {
    return false
  }

  return keys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && isEqual(a[key], b[key]),
  )
}

function cloneMap(source: Y.Map<unknown>): Y.Map<unknown> {
  const clone = new Y.Map<unknown>()

  for (const [key, value] of Object.entries(source.toJSON() as Record<string, unknown>)) {
    clone.set(key, value)
  }

  return clone
}

function applyFields(target: Y.Map<unknown>, fields: Record<string, unknown>): void {
  for (const key of [...target.keys()]) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      target.delete(key)
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    if (!isEqual(toPlain(target.get(key)), value)) {
      target.set(key, value)
    }
  }
}

function applyElements(live: Y.Map<unknown>, desired: Y.Map<unknown>): void {
  for (const id of [...live.keys()]) {
    if (!desired.has(id)) {
      live.delete(id)
    }
  }

  for (const id of [...desired.keys()]) {
    const value = desired.get(id)
    const existing = live.get(id)

    if (value instanceof Y.Map) {
      if (existing instanceof Y.Map) {
        applyFields(existing, value.toJSON() as Record<string, unknown>)
      } else {
        live.set(id, cloneMap(value))
      }

      continue
    }

    if (!isEqual(toPlain(existing), toPlain(value))) {
      live.set(id, toPlain(value))
    }
  }
}

function applyOrder(live: Y.Array<unknown>, desired: Y.Array<unknown>): void {
  const next = desired.toArray().map(toPlain)

  if (isEqual(live.toArray().map(toPlain), next)) {
    return
  }

  live.delete(0, live.length)
  live.insert(0, next)
}

export function applyDocumentState(live: Y.Doc, desired: Y.Doc): void {
  applyElements(live.getMap(ELEMENTS_KEY), desired.getMap(ELEMENTS_KEY))
  applyOrder(live.getArray(ELEMENT_ORDER_KEY), desired.getArray(ELEMENT_ORDER_KEY))
  applyFields(
    live.getMap(APP_STATE_KEY),
    desired.getMap(APP_STATE_KEY).toJSON() as Record<string, unknown>,
  )
}

export async function foldPageState(
  store: PageStore,
  pageId: number,
  bridge: string | null,
  attempts: number = DEFAULT_FOLD_ATTEMPTS,
): Promise<DocumentState | null> {
  const total = Math.max(1, attempts)

  for (let attempt = 0; attempt < total; attempt += 1) {
    const snapshot = await store.latestSnapshot(pageId)
    const boundary = await store.maxSeq(pageId)
    const tail = await store.updatesAfter(pageId, snapshot?.upToSeq ?? 0)
    const confirmed = await store.latestSnapshot(pageId)

    if ((confirmed?.upToSeq ?? null) !== (snapshot?.upToSeq ?? null) && attempt < total - 1) {
      continue
    }

    const parts: Uint8Array[] = []

    if (snapshot) {
      parts.push(snapshot.state)
    } else if (bridge) {
      parts.push(base64ToBytes(bridge))
    }

    parts.push(...tail)

    if (parts.length === 0) {
      return null
    }

    return {
      state: parts.length === 1 ? parts[0] : Y.mergeUpdates(parts),
      upToSeq: Math.max(boundary, snapshot?.upToSeq ?? 0),
    }
  }

  return null
}

export async function restorePageState(
  gateway: DocumentGateway,
  store: PageStore,
  room: string,
  pageId: number,
  target: Uint8Array,
): Promise<DocumentState> {
  const desired = new Y.Doc()
  Y.applyUpdate(desired, target)

  const touched: Y.Doc[] = []
  const connection = await gateway.openDirectConnection(room)

  try {
    await connection.transact((document) => {
      touched.push(document)
      applyDocumentState(document, desired)
    })

    const live = touched[0]

    if (!live) {
      throw new Error('the direct connection did not expose a document')
    }

    const upToSeq = await store.maxSeq(pageId)

    return { state: encodeDocState(live), upToSeq }
  } finally {
    await connection.disconnect()
  }
}
