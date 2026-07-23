import type { BlobLoader } from '@freedraw/engine'
import { assetRepo } from './asset-repo.js'
import { fetchPageAsset, fetchShareAsset } from './page-api.js'

/**
 * Where a board's assets live on the server. Persisted pages upload and cache
 * write-through; public shares are read-only and never cache locally; anonymous
 * boards have no server copy and stay IndexedDB-only until they are promoted.
 */
export type AssetSource =
  | { kind: 'page'; publicId: string }
  | { kind: 'share'; slug: string }
  | { kind: 'local' }

function fetchRemoteAsset(source: AssetSource, assetId: string): Promise<Blob | undefined> {
  if (source.kind === 'page') return fetchPageAsset(source.publicId, assetId)
  if (source.kind === 'share') return fetchShareAsset(source.slug, assetId)
  return Promise.resolve(undefined)
}

/**
 * Blob loader for image rendering and export: IndexedDB first, then the server,
 * caching the server copy for the user's own pages (not merely-viewed shares).
 */
export function createAssetLoader(source: AssetSource): BlobLoader {
  return async (assetId) => {
    const local = await assetRepo.getAsset(assetId).catch(() => undefined)
    if (local) return local

    const remote = await fetchRemoteAsset(source, assetId)
    if (remote && source.kind === 'page') {
      void assetRepo.putAsset(assetId, remote).catch(() => {})
    }
    return remote
  }
}
