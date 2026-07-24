import type {
  Extension,
  onChangePayload,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
} from '@hocuspocus/server'
import * as Y from 'yjs'
import type { PageStore } from './page-store.js'
import { base64ToBytes, bytesToBase64, collectAssetIds, encodeDocState } from './yjs-helpers.js'

export interface Logger {
  info(message: string, meta?: unknown): void
  warn(message: string, meta?: unknown): void
  error(message: string, meta?: unknown): void
}

const noopLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

export interface UpdateLogDatabaseOptions {
  store: PageStore
  logger?: Logger
  stampAssetReferences?: boolean
  pruneSupersededSnapshots?: boolean
}

function originLabel(transactionOrigin: unknown): string | null {
  return typeof transactionOrigin === 'string' && transactionOrigin.length > 0
    ? transactionOrigin
    : null
}

export class UpdateLogDatabase implements Partial<Extension> {
  public readonly extensionName = 'UpdateLogDatabase'

  private readonly store: PageStore
  private readonly logger: Logger
  private readonly shouldStampAssets: boolean
  private readonly shouldPruneSnapshots: boolean

  constructor(options: UpdateLogDatabaseOptions) {
    this.store = options.store
    this.logger = options.logger ?? noopLogger
    this.shouldStampAssets = options.stampAssetReferences ?? true
    this.shouldPruneSnapshots = options.pruneSupersededSnapshots ?? true
  }

  async onLoadDocument(data: onLoadDocumentPayload): Promise<void> {
    const page = await this.store.findPageByRoom(data.documentName)

    if (!page) {
      return
    }

    const snapshot = await this.store.latestSnapshot(page.id)

    if (snapshot) {
      Y.applyUpdate(data.document, snapshot.state)

      const tail = await this.store.updatesAfter(page.id, snapshot.upToSeq)
      for (const update of tail) {
        Y.applyUpdate(data.document, update)
      }

      return
    }

    if (page.document) {
      const base = base64ToBytes(page.document)
      Y.applyUpdate(data.document, base)
      await this.store.insertSnapshot(page.id, base, 0)
    }

    const updates = await this.store.updatesAfter(page.id, 0)
    for (const update of updates) {
      Y.applyUpdate(data.document, update)
    }
  }

  async onChange(data: onChangePayload): Promise<void> {
    const page = await this.store.findPageByRoom(data.documentName)

    if (!page) {
      return
    }

    await this.store.appendUpdate(page.id, data.update, originLabel(data.transactionOrigin))
  }

  async onStoreDocument(data: onStoreDocumentPayload): Promise<void> {
    const page = await this.store.findPageByRoom(data.documentName)

    if (!page) {
      return
    }

    const boundary = await this.store.maxSeq(page.id)
    const state = encodeDocState(data.document)

    const snapshotId = await this.store.insertSnapshot(page.id, state, boundary)
    await this.store.pruneUpdatesUpTo(page.id, boundary)
    await this.store.writeBridge(page.id, bytesToBase64(state))

    if (this.shouldPruneSnapshots) {
      await this.store.pruneAutoSnapshotsBelow(page.id, boundary, snapshotId)
    }

    if (this.shouldStampAssets) {
      await this.stampAssets(page.id, data.document)
    }
  }

  private async stampAssets(pageId: number, doc: Y.Doc): Promise<void> {
    try {
      const assetIds = collectAssetIds(doc)

      if (assetIds.length > 0) {
        await this.store.stampAssetReferences(pageId, assetIds)
      }
    } catch (error) {
      this.logger.warn('UpdateLogDatabase: failed to stamp asset references', error)
    }
  }
}
