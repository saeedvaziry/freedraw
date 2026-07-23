import { ASSET_STORE, openDatabase, runRequest, type IndexedDbFactory } from './db.js'

export interface AssetRepo {
  putAsset(id: string, blob: Blob): Promise<void>
  getAsset(id: string): Promise<Blob | undefined>
  deleteAsset(id: string): Promise<void>
  listAssetIds(): Promise<string[]>
}

export function createAssetRepo(factory?: IndexedDbFactory): AssetRepo {
  const withStore = async <T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await openDatabase(factory)
    try {
      const transaction = db.transaction(ASSET_STORE, mode)
      const result = await runRequest(run(transaction.objectStore(ASSET_STORE)))
      return result
    } finally {
      db.close()
    }
  }

  return {
    async putAsset(id, blob) {
      await withStore('readwrite', (store) => store.put(blob, id))
    },
    async getAsset(id) {
      const blob = await withStore<Blob | undefined>('readonly', (store) => store.get(id))
      return blob ?? undefined
    },
    async deleteAsset(id) {
      await withStore('readwrite', (store) => store.delete(id))
    },
    async listAssetIds() {
      const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
      return keys.filter((key): key is string => typeof key === 'string')
    },
  }
}

export const assetRepo: AssetRepo = createAssetRepo()
