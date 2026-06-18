export const ASSET_STORE = 'assets'
const DB_NAME = 'freedraw-assets'
const DB_VERSION = 1

export interface IndexedDbFactory {
  open(name: string, version: number): IDBOpenDBRequest
}

function resolveFactory(factory?: IndexedDbFactory): IndexedDbFactory | null {
  if (factory) return factory
  if (typeof indexedDB !== 'undefined') return indexedDB
  return null
}

function openAt(idb: IndexedDbFactory, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(ASSET_STORE)) db.createObjectStore(ASSET_STORE)
    }
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another connection'))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function openDatabase(factory?: IndexedDbFactory): Promise<IDBDatabase> {
  const idb = resolveFactory(factory)
  if (!idb) throw new Error('IndexedDB is not available')

  const db = await openAt(idb, DB_VERSION)
  if (db.objectStoreNames.contains(ASSET_STORE)) return db

  const nextVersion = db.version + 1
  db.close()
  return openAt(idb, nextVersion)
}

export function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
