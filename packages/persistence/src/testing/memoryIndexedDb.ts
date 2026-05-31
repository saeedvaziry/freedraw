import type { IndexedDbFactory } from '../db.js'

type Store = Map<string, unknown>

interface FakeRequest {
  result: unknown
  error: unknown
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  onupgradeneeded?: (() => void) | null
}

function settle(request: FakeRequest, result: unknown): FakeRequest {
  request.result = result
  queueMicrotask(() => request.onsuccess?.())
  return request
}

function createObjectStore(store: Store): unknown {
  return {
    put: (value: unknown, key: string) => {
      store.set(key, value)
      return settle({ result: key, error: null, onsuccess: null, onerror: null }, key)
    },
    get: (key: string) =>
      settle({ result: undefined, error: null, onsuccess: null, onerror: null }, store.get(key)),
    delete: (key: string) => {
      store.delete(key)
      return settle({ result: undefined, error: null, onsuccess: null, onerror: null }, undefined)
    },
  }
}

export function createMemoryIndexedDb(): IndexedDbFactory {
  const stores = new Map<string, Store>()

  const open = (): unknown => {
    const request: FakeRequest = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    }
    request.result = {
      objectStoreNames: { contains: (name: string) => stores.has(name) },
      createObjectStore: (name: string) => {
        stores.set(name, new Map())
      },
      transaction: (name: string) => ({
        objectStore: () => createObjectStore(stores.get(name) ?? new Map()),
      }),
      close: () => undefined,
    }
    queueMicrotask(() => {
      request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  }

  return { open: open as IndexedDbFactory['open'] }
}
