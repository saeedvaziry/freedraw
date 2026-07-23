import { DOCUMENT_DB_NAME } from './document-persistence.js'

const PAGE_DB_PREFIX = `${DOCUMENT_DB_NAME}:page:`

/**
 * Delete per-page IndexedDB document stores whose page no longer exists. A page
 * store is named `${DOCUMENT_DB_NAME}:page:${publicId}`; any store whose publicId
 * is not in the live set belongs to a deleted page and is safe to drop (the
 * server holds the authoritative copy for pages that still exist).
 */
export async function gcOrphanedPageStores(livePublicIds: Iterable<string>): Promise<void> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return

  const live = new Set(livePublicIds)

  try {
    const databases = await indexedDB.databases()
    for (const { name } of databases) {
      if (!name || !name.startsWith(PAGE_DB_PREFIX)) continue
      const publicId = name.slice(PAGE_DB_PREFIX.length)
      if (!live.has(publicId)) indexedDB.deleteDatabase(name)
    }
  } catch (error) {
    console.warn('Storage GC failed', error)
  }
}
