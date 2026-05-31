import { describe, expect, it } from 'vitest'
import { createAssetRepo } from './assetRepo.js'
import { createMemoryIndexedDb } from './testing/memoryIndexedDb.js'

describe('assetRepo', () => {
  it('round-trips a blob through put then get', async () => {
    const repo = createAssetRepo(createMemoryIndexedDb())
    const blob = new Blob(['hello'], { type: 'image/png' })
    await repo.putAsset('a', blob)
    const result = await repo.getAsset('a')
    expect(result).toBeInstanceOf(Blob)
    expect(result?.type).toBe('image/png')
  })

  it('returns undefined for a missing id', async () => {
    const repo = createAssetRepo(createMemoryIndexedDb())
    expect(await repo.getAsset('missing')).toBeUndefined()
  })

  it('removes a blob on delete', async () => {
    const repo = createAssetRepo(createMemoryIndexedDb())
    await repo.putAsset('a', new Blob(['x'], { type: 'image/png' }))
    await repo.deleteAsset('a')
    expect(await repo.getAsset('a')).toBeUndefined()
  })
})
