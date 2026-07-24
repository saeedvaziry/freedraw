import type { Queryable } from './db.js'

export interface PageRecord {
  id: number
  document: string | null
}

export interface SnapshotRecord {
  state: Uint8Array
  upToSeq: number
}

export interface PageStore {
  findPageByRoom(room: string): Promise<PageRecord | null>
  latestSnapshot(pageId: number): Promise<SnapshotRecord | null>
  updatesAfter(pageId: number, afterSeq: number): Promise<Uint8Array[]>
  maxSeq(pageId: number): Promise<number>
  appendUpdate(pageId: number, update: Uint8Array, origin: string | null): Promise<void>
  insertSnapshot(pageId: number, state: Uint8Array, upToSeq: number): Promise<number>
  pruneUpdatesUpTo(pageId: number, upToSeq: number): Promise<number>
  pruneAutoSnapshotsBelow(pageId: number, upToSeq: number, keepSnapshotId: number): Promise<number>
  writeBridge(pageId: number, base64: string): Promise<void>
  stampAssetReferences(pageId: number, assetIds: string[]): Promise<void>
}

export interface MysqlPageStoreOptions {
  seqMaxRetries?: number
}

const DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY'

interface DuplicateEntryError {
  code?: string
}

function isDuplicateEntry(error: unknown): boolean {
  return (error as DuplicateEntryError)?.code === DUPLICATE_ENTRY_CODE
}

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

export class MysqlPageStore implements PageStore {
  private readonly db: Queryable
  private readonly seqMaxRetries: number

  constructor(db: Queryable, options: MysqlPageStoreOptions = {}) {
    this.db = db
    this.seqMaxRetries = Math.max(1, options.seqMaxRetries ?? 5)
  }

  async findPageByRoom(room: string): Promise<PageRecord | null> {
    const [rows] = await this.db.query(
      'SELECT id, document FROM pages WHERE public_id = ? LIMIT 1',
      [room],
    )

    const row = (rows as Array<{ id: number; document: string | null }>)[0]

    if (!row) {
      return null
    }

    return { id: Number(row.id), document: row.document ?? null }
  }

  async latestSnapshot(pageId: number): Promise<SnapshotRecord | null> {
    const [rows] = await this.db.query(
      'SELECT state, up_to_seq FROM page_snapshots WHERE page_id = ? ORDER BY up_to_seq DESC, id DESC LIMIT 1',
      [pageId],
    )

    const row = (rows as Array<{ state: Buffer; up_to_seq: number }>)[0]

    if (!row) {
      return null
    }

    return { state: new Uint8Array(row.state), upToSeq: Number(row.up_to_seq) }
  }

  async updatesAfter(pageId: number, afterSeq: number): Promise<Uint8Array[]> {
    const [rows] = await this.db.query(
      'SELECT `update` FROM page_updates WHERE page_id = ? AND seq > ? ORDER BY seq ASC',
      [pageId, afterSeq],
    )

    return (rows as Array<{ update: Buffer }>).map((row) => new Uint8Array(row.update))
  }

  async maxSeq(pageId: number): Promise<number> {
    const [rows] = await this.db.query(
      'SELECT COALESCE(MAX(seq), 0) AS max_seq FROM page_updates WHERE page_id = ?',
      [pageId],
    )

    const row = (rows as Array<{ max_seq: number }>)[0]
    return row ? Number(row.max_seq) : 0
  }

  async appendUpdate(pageId: number, update: Uint8Array, origin: string | null): Promise<void> {
    const payload = toBuffer(update)
    let lastError: unknown

    for (let attempt = 0; attempt < this.seqMaxRetries; attempt += 1) {
      try {
        await this.db.query(
          'INSERT INTO page_updates (page_id, seq, `update`, origin, created_at) ' +
            'SELECT ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ? FROM page_updates WHERE page_id = ?',
          [pageId, payload, origin, new Date(), pageId],
        )

        return
      } catch (error) {
        if (!isDuplicateEntry(error)) {
          throw error
        }

        lastError = error
      }
    }

    throw lastError
  }

  async insertSnapshot(pageId: number, state: Uint8Array, upToSeq: number): Promise<number> {
    const now = new Date()
    const [result] = await this.db.query(
      'INSERT INTO page_snapshots (page_id, state, up_to_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [pageId, toBuffer(state), upToSeq, now, now],
    )

    return Number((result as { insertId: number }).insertId)
  }

  async pruneUpdatesUpTo(pageId: number, upToSeq: number): Promise<number> {
    const [result] = await this.db.query(
      'DELETE FROM page_updates WHERE page_id = ? AND seq <= ?',
      [pageId, upToSeq],
    )

    return Number((result as { affectedRows: number }).affectedRows)
  }

  async pruneAutoSnapshotsBelow(
    pageId: number,
    upToSeq: number,
    keepSnapshotId: number,
  ): Promise<number> {
    const [result] = await this.db.query(
      'DELETE FROM page_snapshots WHERE page_id = ? AND up_to_seq <= ? AND id <> ? ' +
        'AND label IS NULL AND created_by IS NULL',
      [pageId, upToSeq, keepSnapshotId],
    )

    return Number((result as { affectedRows: number }).affectedRows)
  }

  async writeBridge(pageId: number, base64: string): Promise<void> {
    await this.db.query('UPDATE pages SET document = ? WHERE id = ?', [base64, pageId])
  }

  async stampAssetReferences(pageId: number, assetIds: string[]): Promise<void> {
    if (assetIds.length === 0) {
      return
    }

    const placeholders = assetIds.map(() => '?').join(', ')
    await this.db.query(
      `UPDATE page_assets SET referenced_at = ? WHERE page_id = ? AND asset_id IN (${placeholders})`,
      [new Date(), pageId, ...assetIds],
    )
  }
}
