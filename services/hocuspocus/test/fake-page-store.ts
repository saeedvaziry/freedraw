import type { PageRecord, PageStore, SnapshotRecord } from '../src/page-store.js'

interface FakeUpdate {
  seq: number
  update: Uint8Array
  origin: string | null
}

interface FakeSnapshot {
  id: number
  state: Uint8Array
  upToSeq: number
  label: string | null
  createdBy: number | null
}

export interface AssetStamp {
  pageId: number
  assetIds: string[]
}

export class FakePageStore implements PageStore {
  public document: string | null
  public readonly updates: FakeUpdate[] = []
  public readonly snapshots: FakeSnapshot[] = []
  public readonly assetStamps: AssetStamp[] = []

  private readonly pageId: number
  private readonly room: string
  private snapshotAutoId = 0

  constructor(options: { pageId?: number; room?: string; document?: string | null } = {}) {
    this.pageId = options.pageId ?? 1
    this.room = options.room ?? 'room-1'
    this.document = options.document ?? null
  }

  seedUpdate(update: Uint8Array, origin: string | null = null): void {
    this.updates.push({ seq: this.nextSeq(), update, origin })
  }

  seedUpdateAtSeq(seq: number, update: Uint8Array, origin: string | null = null): void {
    this.updates.push({ seq, update, origin })
  }

  seedSnapshot(state: Uint8Array, upToSeq: number, label: string | null = null, createdBy: number | null = null): number {
    const id = (this.snapshotAutoId += 1)
    this.snapshots.push({ id, state, upToSeq, label, createdBy })
    return id
  }

  private nextSeq(): number {
    return this.updates.reduce((max, row) => Math.max(max, row.seq), 0) + 1
  }

  async findPageByRoom(room: string): Promise<PageRecord | null> {
    if (room !== this.room) {
      return null
    }

    return { id: this.pageId, document: this.document }
  }

  async latestSnapshot(pageId: number): Promise<SnapshotRecord | null> {
    const rows = this.snapshots.filter((row) => pageId === this.pageId)

    if (rows.length === 0) {
      return null
    }

    const latest = rows.reduce((best, row) =>
      row.upToSeq > best.upToSeq || (row.upToSeq === best.upToSeq && row.id > best.id) ? row : best,
    )

    return { state: latest.state, upToSeq: latest.upToSeq }
  }

  async updatesAfter(pageId: number, afterSeq: number): Promise<Uint8Array[]> {
    return this.updates
      .filter((row) => pageId === this.pageId && row.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq)
      .map((row) => row.update)
  }

  async maxSeq(pageId: number): Promise<number> {
    return this.updates.reduce((max, row) => (pageId === this.pageId ? Math.max(max, row.seq) : max), 0)
  }

  async appendUpdate(pageId: number, update: Uint8Array, origin: string | null): Promise<void> {
    if (pageId !== this.pageId) {
      return
    }

    this.updates.push({ seq: this.nextSeq(), update, origin })
  }

  async insertSnapshot(pageId: number, state: Uint8Array, upToSeq: number): Promise<number> {
    return this.seedSnapshot(state, upToSeq)
  }

  async pruneUpdatesUpTo(pageId: number, upToSeq: number): Promise<number> {
    let removed = 0

    for (let index = this.updates.length - 1; index >= 0; index -= 1) {
      if (pageId === this.pageId && this.updates[index]!.seq <= upToSeq) {
        this.updates.splice(index, 1)
        removed += 1
      }
    }

    return removed
  }

  async pruneAutoSnapshotsBelow(pageId: number, upToSeq: number, keepSnapshotId: number): Promise<number> {
    let removed = 0

    for (let index = this.snapshots.length - 1; index >= 0; index -= 1) {
      const row = this.snapshots[index]!

      if (
        pageId === this.pageId &&
        row.id !== keepSnapshotId &&
        row.upToSeq <= upToSeq &&
        row.label === null &&
        row.createdBy === null
      ) {
        this.snapshots.splice(index, 1)
        removed += 1
      }
    }

    return removed
  }

  async writeBridge(pageId: number, base64: string): Promise<void> {
    if (pageId === this.pageId) {
      this.document = base64
    }
  }

  async stampAssetReferences(pageId: number, assetIds: string[]): Promise<void> {
    this.assetStamps.push({ pageId, assetIds })
  }
}
