import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Queryable } from '../src/db.js'
import { MysqlPageStore } from '../src/page-store.js'

type QueryFn = (sql: string, params?: ReadonlyArray<unknown>) => Promise<[unknown, unknown]>

interface MockQueryable extends Queryable {
  query: ReturnType<typeof vi.fn<QueryFn>>
}

function createQueryable(): MockQueryable {
  return { query: vi.fn<QueryFn>() }
}

function lastSql(db: MockQueryable): string {
  const calls = db.query.mock.calls
  return String(calls[calls.length - 1]![0])
}

function lastParams(db: MockQueryable): unknown[] {
  const calls = db.query.mock.calls
  return calls[calls.length - 1]![1] as unknown[]
}

describe('MysqlPageStore', () => {
  let db: MockQueryable

  beforeEach(() => {
    db = createQueryable()
  })

  it('finds a page by its public id', async () => {
    db.query.mockResolvedValueOnce([[{ id: 5, document: 'YmFzZTY0' }], []])

    const page = await new MysqlPageStore(db).findPageByRoom('public-123')

    expect(page).toEqual({ id: 5, document: 'YmFzZTY0' })
    expect(lastSql(db)).toContain('FROM pages WHERE public_id = ?')
    expect(lastParams(db)).toEqual(['public-123'])
  })

  it('returns null when the page does not exist', async () => {
    db.query.mockResolvedValueOnce([[], []])

    expect(await new MysqlPageStore(db).findPageByRoom('missing')).toBeNull()
  })

  it('loads the latest snapshot ordered by up_to_seq', async () => {
    const state = Buffer.from([1, 2, 3])
    db.query.mockResolvedValueOnce([[{ state, up_to_seq: 12 }], []])

    const snapshot = await new MysqlPageStore(db).latestSnapshot(5)

    expect(snapshot).toEqual({ state: new Uint8Array([1, 2, 3]), upToSeq: 12 })
    expect(lastSql(db)).toContain('FROM page_snapshots WHERE page_id = ?')
    expect(lastSql(db)).toContain('ORDER BY up_to_seq DESC')
  })

  it('returns null when there is no snapshot', async () => {
    db.query.mockResolvedValueOnce([[], []])
    expect(await new MysqlPageStore(db).latestSnapshot(5)).toBeNull()
  })

  it('loads updates after a sequence number in order', async () => {
    db.query.mockResolvedValueOnce([
      [{ update: Buffer.from([9]) }, { update: Buffer.from([10]) }],
      [],
    ])

    const updates = await new MysqlPageStore(db).updatesAfter(5, 4)

    expect(updates).toEqual([new Uint8Array([9]), new Uint8Array([10])])
    expect(lastSql(db)).toContain('FROM page_updates WHERE page_id = ? AND seq > ?')
    expect(lastSql(db)).toContain('ORDER BY seq ASC')
    expect(lastParams(db)).toEqual([5, 4])
  })

  it('reads the maximum sequence number', async () => {
    db.query.mockResolvedValueOnce([[{ max_seq: 42 }], []])

    expect(await new MysqlPageStore(db).maxSeq(5)).toBe(42)
    expect(lastSql(db)).toContain('COALESCE(MAX(seq), 0)')
  })

  it('appends an update by allocating the next sequence atomically', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 1 }, []])

    await new MysqlPageStore(db).appendUpdate(5, new Uint8Array([7, 8]), 'conn-1')

    expect(lastSql(db)).toContain('INSERT INTO page_updates')
    expect(lastSql(db)).toContain('COALESCE(MAX(seq), 0) + 1')

    const params = lastParams(db)
    expect(params[0]).toBe(5)
    expect(Buffer.isBuffer(params[1])).toBe(true)
    expect(params[2]).toBe('conn-1')
    expect(params[3]).toBeInstanceOf(Date)
    expect(params[4]).toBe(5)
  })

  it('retries appending on a duplicate sequence collision', async () => {
    db.query
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }))
      .mockResolvedValueOnce([{ insertId: 1 }, []])

    await new MysqlPageStore(db, { seqMaxRetries: 3 }).appendUpdate(5, new Uint8Array([1]), null)

    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it('gives up after exhausting the retry budget', async () => {
    db.query.mockRejectedValue(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }))

    await expect(
      new MysqlPageStore(db, { seqMaxRetries: 2 }).appendUpdate(5, new Uint8Array([1]), null),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' })

    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it('rethrows non-duplicate errors without retrying', async () => {
    db.query.mockRejectedValue(Object.assign(new Error('boom'), { code: 'ER_OTHER' }))

    await expect(
      new MysqlPageStore(db).appendUpdate(5, new Uint8Array([1]), null),
    ).rejects.toThrow('boom')

    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it('inserts a snapshot and returns its id', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 99 }, []])

    const id = await new MysqlPageStore(db).insertSnapshot(5, new Uint8Array([1, 2]), 12)

    expect(id).toBe(99)
    expect(lastSql(db)).toContain('INSERT INTO page_snapshots')
    const params = lastParams(db)
    expect(params[0]).toBe(5)
    expect(Buffer.isBuffer(params[1])).toBe(true)
    expect(params[2]).toBe(12)
  })

  it('prunes only updates at or below the snapshot boundary', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 3 }, []])

    const removed = await new MysqlPageStore(db).pruneUpdatesUpTo(5, 12)

    expect(removed).toBe(3)
    expect(lastSql(db)).toBe('DELETE FROM page_updates WHERE page_id = ? AND seq <= ?')
    expect(lastParams(db)).toEqual([5, 12])
  })

  it('prunes superseded auto snapshots while keeping labeled and user ones', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }, []])

    await new MysqlPageStore(db).pruneAutoSnapshotsBelow(5, 12, 99)

    const sql = lastSql(db)
    expect(sql).toContain('DELETE FROM page_snapshots')
    expect(sql).toContain('up_to_seq <= ?')
    expect(sql).toContain('id <> ?')
    expect(sql).toContain('label IS NULL')
    expect(sql).toContain('created_by IS NULL')
    expect(lastParams(db)).toEqual([5, 12, 99])
  })

  it('writes the compacted state back to the pages bridge column', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }, []])

    await new MysqlPageStore(db).writeBridge(5, 'YmFzZTY0')

    expect(lastSql(db)).toBe('UPDATE pages SET document = ? WHERE id = ?')
    expect(lastParams(db)).toEqual(['YmFzZTY0', 5])
  })

  it('stamps referenced assets with one placeholder per id', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 2 }, []])

    await new MysqlPageStore(db).stampAssetReferences(5, ['a', 'b'])

    const sql = lastSql(db)
    expect(sql).toContain('UPDATE page_assets SET referenced_at = ?')
    expect(sql).toContain('asset_id IN (?, ?)')
    const params = lastParams(db)
    expect(params[0]).toBeInstanceOf(Date)
    expect(params[1]).toBe(5)
    expect(params.slice(2)).toEqual(['a', 'b'])
  })

  it('skips the asset stamp query when there are no referenced assets', async () => {
    await new MysqlPageStore(db).stampAssetReferences(5, [])
    expect(db.query).not.toHaveBeenCalled()
  })
})
