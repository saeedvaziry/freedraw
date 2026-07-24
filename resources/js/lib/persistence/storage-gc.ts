import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { assetRepo, type AssetRepo } from './asset-repo.js'
import { DOCUMENT_DB_NAME } from './document-persistence.js'

const PAGE_DB_PREFIX = `${DOCUMENT_DB_NAME}:page:`
const DOC_OPEN_TIMEOUT_MS = 10_000
const ASSET_GC_MIN_INTERVAL_MS = 5 * 60 * 1000
const IDLE_TIMEOUT_MS = 5_000
const IDLE_FALLBACK_MS = 2_000

export interface AssetReferenceIndex {
  complete: boolean
  referenced: Set<string>
}

function canEnumerateDatabases(): boolean {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function'
}

async function databaseNames(): Promise<Set<string>> {
  const databases = await indexedDB.databases()
  const names = new Set<string>()

  for (const { name } of databases) {
    if (name) {
      names.add(name)
    }
  }

  return names
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out opening ${label}`)), ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

export function collectAssetIds(doc: Y.Doc): Set<string> {
  const ids = new Set<string>()
  const elements = doc.getMap('elements')

  if (!(elements instanceof Y.Map)) {
    throw new Error('Scene elements is not a map')
  }

  for (const value of elements.values()) {
    if (!(value instanceof Y.Map)) {
      throw new Error('Scene element is not a map')
    }

    if (value.get('type') !== 'image') {
      continue
    }

    const assetId = value.get('assetId')

    if (typeof assetId !== 'string' || assetId.length === 0) {
      throw new Error('Image element has no asset id')
    }

    ids.add(assetId)
  }

  return ids
}

async function readReferencedAssetIds(dbName: string): Promise<Set<string>> {
  const doc = new Y.Doc()
  const provider = new IndexeddbPersistence(dbName, doc)

  try {
    await withTimeout(provider.whenSynced, DOC_OPEN_TIMEOUT_MS, dbName)

    return collectAssetIds(doc)
  } finally {
    await provider.destroy().catch(() => undefined)
    doc.destroy()
  }
}

export async function buildAssetReferenceIndex(
  livePublicIds: Iterable<string>,
): Promise<AssetReferenceIndex> {
  const referenced = new Set<string>()

  if (!canEnumerateDatabases()) {
    return { complete: false, referenced }
  }

  const names = await databaseNames()

  for (const publicId of livePublicIds) {
    if (!names.has(`${PAGE_DB_PREFIX}${publicId}`)) {
      return { complete: false, referenced }
    }
  }

  const docNames: string[] = []

  for (const name of names) {
    if (name === DOCUMENT_DB_NAME || name.startsWith(PAGE_DB_PREFIX)) {
      docNames.push(name)
    }
  }

  for (const name of docNames) {
    const ids = await readReferencedAssetIds(name)

    for (const id of ids) {
      referenced.add(id)
    }
  }

  return { complete: true, referenced }
}

export async function gcOrphanedAssets(
  livePublicIds: Iterable<string>,
  repo: AssetRepo = assetRepo,
): Promise<void> {
  try {
    const index = await buildAssetReferenceIndex(livePublicIds)

    if (!index.complete) {
      return
    }

    const stored = await repo.listAssetIds()

    for (const id of stored) {
      if (!index.referenced.has(id)) {
        await repo.deleteAsset(id)
      }
    }
  } catch (error) {
    console.warn('Asset GC skipped', error)
  }
}

let assetGcRunning = false
let assetGcLastRunAt = 0

function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => run(), { timeout: IDLE_TIMEOUT_MS })

    return
  }

  setTimeout(run, IDLE_FALLBACK_MS)
}

function scheduleAssetGc(livePublicIds: string[]): void {
  const now = Date.now()

  if (assetGcRunning || now - assetGcLastRunAt < ASSET_GC_MIN_INTERVAL_MS) {
    return
  }

  assetGcRunning = true
  assetGcLastRunAt = now

  whenIdle(() => {
    void gcOrphanedAssets(livePublicIds).finally(() => {
      assetGcRunning = false
      assetGcLastRunAt = Date.now()
    })
  })
}

export async function gcOrphanedStorage(livePublicIds: Iterable<string>): Promise<void> {
  if (!canEnumerateDatabases()) {
    return
  }

  const liveIds = [...livePublicIds]
  const live = new Set(liveIds)

  try {
    const names = await databaseNames()

    for (const name of names) {
      if (!name.startsWith(PAGE_DB_PREFIX)) {
        continue
      }

      const publicId = name.slice(PAGE_DB_PREFIX.length)

      if (!live.has(publicId)) {
        await deleteDatabase(name)
      }
    }
  } catch (error) {
    console.warn('Storage GC failed', error)

    return
  }

  scheduleAssetGc(liveIds)
}
