export { createAssetRepo, assetRepo } from './asset-repo.js'
export type { AssetRepo } from './asset-repo.js'
export { ASSET_STORE } from './db.js'
export type { IndexedDbFactory } from './db.js'
export {
  applyBase64Update,
  createRemotePage,
  deleteRemotePage,
  documentHasContent,
  encodeDocAsBase64,
  fetchPageAsset,
  fetchShareAsset,
  isCsrfExpired,
  PageRequestError,
  updateRemotePage,
  updateRemoteShare,
  uploadPageAsset,
} from './page-api.js'
export { createAssetLoader } from './asset-loader.js'
export type { AssetSource } from './asset-loader.js'
export type { DeletePageResult, SavePagePayload, SharePagePayload } from './page-api.js'
export {
  createPageVersion,
  fetchPageVersion,
  fetchPageVersions,
  restorePageVersion,
  VersionRequestError,
} from './version-api.js'
export type { PageVersion, PageVersionCreator, PageVersionState } from './version-api.js'
export { createPageSync } from './page-sync.js'
export type { PageSync, SyncStatus } from './page-sync.js'
export { createCollabSync, deriveSyncStatus } from './collab-provider.js'
export type { CollabAwareness, CollabSync, CollabSyncOptions } from './collab-provider.js'
export { readCollabConfig } from './collab-config.js'
export type { CollabConfig } from './collab-config.js'
export { createDocumentPersistence, DOCUMENT_DB_NAME } from './document-persistence.js'
export type { DocumentPersistence } from './document-persistence.js'
export {
  buildAssetReferenceIndex,
  collectAssetIds,
  gcOrphanedAssets,
  gcOrphanedStorage,
} from './storage-gc.js'
export type { AssetReferenceIndex } from './storage-gc.js'
export { attachViewportPersistence, viewportKeyFor } from './viewport-store.js'
