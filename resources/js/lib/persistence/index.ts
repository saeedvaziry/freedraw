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
export { createPageSync } from './page-sync.js'
export type { PageSync, SyncStatus } from './page-sync.js'
export { createDocumentPersistence, DOCUMENT_DB_NAME } from './document-persistence.js'
export type { DocumentPersistence } from './document-persistence.js'
export { gcOrphanedPageStores } from './storage-gc.js'
