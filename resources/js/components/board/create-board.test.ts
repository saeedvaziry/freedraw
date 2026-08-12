import { waitFor } from '@testing-library/react'
import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createImage,
  createShape,
  SceneStore,
  seedAppState,
  type Element,
} from '@freedraw/engine'
import type {
  DocumentPersistence,
  PageSync,
  SavePagePayload,
} from '@/lib/persistence'
import {
  applyBase64Update,
  DOCUMENT_DB_NAME,
  encodeDocAsBase64,
} from '@/lib/persistence'
import type { BoardPage } from '@/types'
import type { Board, BoardContext, CreateBoardResult } from './create-board.js'

const { persistenceMocks } = vi.hoisted(() => ({
  persistenceMocks: {
    assetRepo: { getAsset: vi.fn() },
    createCollabSync: vi.fn(),
    createDocumentPersistence: vi.fn(),
    createPageSync: vi.fn(),
    createRemotePage: vi.fn(),
    readCollabConfig: vi.fn(),
    uploadPageAsset: vi.fn(),
  },
}))

vi.mock('@/lib/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/persistence')>()

  return {
    ...actual,
    ...persistenceMocks,
  }
})

interface FakePersistence extends DocumentPersistence {
  clear: ReturnType<typeof vi.fn<() => Promise<void>>>
  destroy: ReturnType<typeof vi.fn<() => void>>
}

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

function fakePersistence(
  doc: Y.Doc,
  clear: () => Promise<void> = () => Promise.resolve(),
): FakePersistence {
  return {
    doc,
    whenSynced: Promise.resolve(),
    clear: vi.fn(clear),
    destroy: vi.fn(),
  }
}

function fakeSync(): PageSync {
  return {
    flush: vi.fn(() => Promise.resolve()),
    destroy: vi.fn(),
    getStatus: vi.fn((): 'saved' => 'saved'),
    subscribe: vi.fn(() => () => undefined),
  }
}

function boardPage(overrides: Partial<BoardPage> = {}): BoardPage {
  return {
    publicId: 'page-1',
    organizationId: 7,
    title: 'Project board',
    document: null,
    url: '/p/page-1',
    visibility: 'private',
    permission: 'edit',
    shareUrl: null,
    canShare: true,
    canEdit: true,
    updatedAt: null,
    ...overrides,
  }
}

function sceneDocument(elements: Element[] = []): Y.Doc {
  const doc = new Y.Doc()
  seedAppState(doc)
  const store = new SceneStore(doc)
  store.transact((api) => elements.forEach((element) => api.addElement(element)))
  store.destroy()
  return doc
}

function shape(id: string) {
  return createShape({ id, x: 10, y: 20, width: 120, height: 80 })
}

function image(id: string, assetId: string) {
  return createImage({
    id,
    assetId,
    x: 30,
    y: 40,
    naturalWidth: 640,
    naturalHeight: 480,
    viewportWidth: 1000,
    viewportHeight: 800,
  })
}

function editableContext(initialPage: BoardPage | null = null): BoardContext {
  return { userId: 3, organizationId: 7, initialPage }
}

function expectBoard(result: CreateBoardResult): Board {
  if ('redirectTo' in result) {
    throw new Error(`Expected a board, received redirect to ${result.redirectTo}`)
  }
  return result
}

async function loadCreateBoard() {
  const { createBoard } = await import('./create-board.js')
  return createBoard
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  localStorage.clear()
  persistenceMocks.readCollabConfig.mockReturnValue({ enabled: false, url: '' })
  persistenceMocks.assetRepo.getAsset.mockResolvedValue(undefined)
  persistenceMocks.uploadPageAsset.mockResolvedValue(undefined)
  persistenceMocks.createPageSync.mockReturnValue(fakeSync())
  persistenceMocks.createCollabSync.mockReturnValue(fakeSync())
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createBoard public shares', () => {
  it('hydrates a public share in memory and uses share-only realtime credentials', async () => {
    const source = sceneDocument([shape('shared-shape')])
    const page = boardPage({
      publicId: 'shared-page',
      document: encodeDocAsBase64(source),
      url: '/s/public-slug',
      visibility: 'public',
      permission: 'view',
      shareUrl: 'https://freedraw.test/s/public-slug',
      canShare: false,
      canEdit: false,
    })
    const sync = fakeSync()
    persistenceMocks.readCollabConfig.mockReturnValue({
      enabled: true,
      url: 'wss://freedraw.test/collaboration',
    })
    persistenceMocks.createCollabSync.mockReturnValue(sync)

    const createBoard = await loadCreateBoard()
    const board = expectBoard(
      await createBoard({
        userId: null,
        organizationId: null,
        initialPage: page,
        publicView: true,
      }),
    )

    expect(persistenceMocks.createDocumentPersistence).not.toHaveBeenCalled()
    expect(persistenceMocks.createPageSync).not.toHaveBeenCalled()
    expect(persistenceMocks.createCollabSync).toHaveBeenCalledWith({
      doc: board.persistence.doc,
      room: 'shared-page',
      url: 'wss://freedraw.test/collaboration',
      tokenUrl: '/s/public-slug/realtime-token',
    })
    expect(board.persistence.provider).toBeUndefined()
    expect(board.sync).toBe(sync)
    expect(board.assetSource).toEqual({ kind: 'share', slug: 'public-slug' })
    expect(board.store.getSnapshot().order).toEqual(['shared-shape'])
  })
})

describe('createBoard anonymous recovery', () => {
  it('backs up corrupt local data before clearing it and opening a fresh board', async () => {
    const corruptDoc = new Y.Doc()
    corruptDoc.getMap('elements').set('broken', 'not-an-element')
    const corrupt = fakePersistence(corruptDoc)
    const fresh = fakePersistence(new Y.Doc())
    persistenceMocks.createDocumentPersistence
      .mockReturnValueOnce(corrupt)
      .mockReturnValueOnce(fresh)

    const createBoard = await loadCreateBoard()
    const board = expectBoard(
      await createBoard({ userId: null, organizationId: null, initialPage: null }),
    )

    const backup = localStorage.getItem('freedraw:corrupt-backup')
    expect(backup).not.toBeNull()
    const backedUpDoc = new Y.Doc()
    applyBase64Update(backedUpDoc, backup!)
    expect(backedUpDoc.getMap('elements').get('broken')).toBe('not-an-element')
    expect(corrupt.clear).toHaveBeenCalledOnce()
    expect(corrupt.destroy).toHaveBeenCalledOnce()
    expect(corrupt.clear.mock.invocationCallOrder[0]).toBeLessThan(
      corrupt.destroy.mock.invocationCallOrder[0]!,
    )
    expect(board.persistence).toBe(fresh)
    expect(fresh.clear).not.toHaveBeenCalled()
    expect(board.store.getSnapshot().order).toEqual([])
    expect(board.assetSource).toEqual({ kind: 'local' })
  })
})

describe('createBoard anonymous promotion', () => {
  it('creates the remote page with the local scene and uploads referenced assets before clearing', async () => {
    const localDoc = sceneDocument([shape('shape-1'), image('image-1', 'asset-1')])
    const events: string[] = []
    const local = fakePersistence(localDoc, async () => {
      events.push('clear')
    })
    const created = boardPage({ publicId: 'promoted', url: '/p/promoted' })
    const blob = new Blob(['image'], { type: 'image/png' })
    const upload = deferred<void>()
    let payload: SavePagePayload | undefined
    persistenceMocks.createDocumentPersistence.mockReturnValue(local)
    persistenceMocks.createRemotePage.mockImplementation(async (next: SavePagePayload) => {
      payload = next
      events.push('create')
      return created
    })
    persistenceMocks.assetRepo.getAsset.mockResolvedValue(blob)
    persistenceMocks.uploadPageAsset.mockImplementation(async () => {
      events.push('upload-start')
      await upload.promise
      events.push('upload-finish')
    })

    const createBoard = await loadCreateBoard()
    const resultPromise = createBoard(editableContext())

    await waitFor(() => expect(persistenceMocks.uploadPageAsset).toHaveBeenCalledOnce())

    expect(local.clear).not.toHaveBeenCalled()
    expect(localStorage.getItem('freedraw:promoted-page')).toBe(JSON.stringify(created))
    expect(payload?.title).toBe('Untitled page')
    expect(payload?.document).toEqual(expect.any(String))
    const transferred = new Y.Doc()
    applyBase64Update(transferred, payload!.document!)
    expect(new SceneStore(transferred).getSnapshot().order).toEqual(['shape-1', 'image-1'])
    expect(persistenceMocks.assetRepo.getAsset).toHaveBeenCalledWith('asset-1')
    expect(persistenceMocks.uploadPageAsset).toHaveBeenCalledWith(
      'promoted',
      'asset-1',
      blob,
    )

    upload.resolve()

    await expect(resultPromise).resolves.toEqual({ redirectTo: '/p/promoted' })
    expect(events).toEqual(['create', 'upload-start', 'upload-finish', 'clear'])
    expect(localStorage.getItem('freedraw:promoted-page')).toBeNull()
    expect(local.destroy).toHaveBeenCalledOnce()
  })

  it('preserves the local board when remote page creation fails', async () => {
    const localDoc = sceneDocument([shape('kept-shape')])
    const local = fakePersistence(localDoc)
    const failure = new Error('network unavailable')
    persistenceMocks.createDocumentPersistence.mockReturnValue(local)
    persistenceMocks.createRemotePage.mockRejectedValue(failure)

    const createBoard = await loadCreateBoard()

    await expect(createBoard(editableContext())).rejects.toBe(failure)
    expect(local.clear).not.toHaveBeenCalled()
    expect(localStorage.getItem('freedraw:promoted-page')).toBeNull()
    expect(persistenceMocks.assetRepo.getAsset).not.toHaveBeenCalled()
    expect(persistenceMocks.uploadPageAsset).not.toHaveBeenCalled()
    expect(new SceneStore(localDoc).getSnapshot().order).toEqual(['kept-shape'])
    expect(local.destroy).toHaveBeenCalledOnce()
  })

  it('reuses the crash marker instead of creating a duplicate page after clear fails', async () => {
    const localDoc = sceneDocument([shape('promoted-shape')])
    const clearFailure = new Error('IndexedDB clear failed')
    const interrupted = fakePersistence(localDoc, () => Promise.reject(clearFailure))
    const recovery = fakePersistence(new Y.Doc())
    const created = boardPage({ publicId: 'already-created', url: '/p/already-created' })
    persistenceMocks.createDocumentPersistence
      .mockReturnValueOnce(interrupted)
      .mockReturnValueOnce(recovery)
    persistenceMocks.createRemotePage.mockResolvedValue(created)

    const createBoard = await loadCreateBoard()

    await expect(createBoard(editableContext())).rejects.toBe(clearFailure)
    expect(localStorage.getItem('freedraw:promoted-page')).toBe(JSON.stringify(created))

    await expect(createBoard(editableContext())).resolves.toEqual({
      redirectTo: '/p/already-created',
    })
    expect(persistenceMocks.createRemotePage).toHaveBeenCalledOnce()
    expect(recovery.clear).toHaveBeenCalledOnce()
    expect(localStorage.getItem('freedraw:promoted-page')).toBeNull()
  })

  it('deduplicates concurrent creation of an authenticated user\'s first page', async () => {
    const local = fakePersistence(new Y.Doc())
    const pendingPage = deferred<BoardPage>()
    const created = boardPage({ publicId: 'first-page', url: '/p/first-page' })
    persistenceMocks.createDocumentPersistence.mockReturnValue(local)
    persistenceMocks.createRemotePage.mockReturnValue(pendingPage.promise)

    const createBoard = await loadCreateBoard()
    const first = createBoard(editableContext())
    const second = createBoard(editableContext())

    await waitFor(() => expect(persistenceMocks.createRemotePage).toHaveBeenCalledOnce())

    expect(persistenceMocks.createRemotePage).toHaveBeenCalledWith({ title: 'Untitled page' })
    pendingPage.resolve(created)

    await expect(Promise.all([first, second])).resolves.toEqual([
      { redirectTo: '/p/first-page' },
      { redirectTo: '/p/first-page' },
    ])
    expect(persistenceMocks.createDocumentPersistence).toHaveBeenCalledOnce()
  })
})

describe('createBoard authenticated page recovery', () => {
  it('clears an invalid cached page and restores the server document into fresh persistence', async () => {
    const serverDoc = sceneDocument([shape('server-shape')])
    const page = boardPage({ document: encodeDocAsBase64(serverDoc) })
    const promotion = fakePersistence(new Y.Doc())
    let invalidCache: FakePersistence | null = null
    let restored: FakePersistence | null = null

    persistenceMocks.createDocumentPersistence.mockImplementation(
      (doc: Y.Doc = new Y.Doc(), name: string = DOCUMENT_DB_NAME) => {
        if (name === DOCUMENT_DB_NAME) return promotion
        if (!invalidCache) {
          doc.getMap('elements').set('corrupt-cache-entry', 'invalid')
          invalidCache = fakePersistence(doc)
          return invalidCache
        }
        restored = fakePersistence(doc)
        return restored
      },
    )

    const sync = fakeSync()
    persistenceMocks.createPageSync.mockReturnValue(sync)

    const createBoard = await loadCreateBoard()
    const board = expectBoard(await createBoard(editableContext(page)))

    expect(invalidCache).not.toBeNull()
    expect(restored).not.toBeNull()
    expect(invalidCache!.clear).toHaveBeenCalledOnce()
    expect(invalidCache!.destroy).toHaveBeenCalledOnce()
    expect(board.persistence).toBe(restored)
    expect(board.store.getSnapshot().order).toEqual(['server-shape'])
    expect(board.store.getSnapshot().elements['corrupt-cache-entry']).toBeUndefined()
    expect(persistenceMocks.createPageSync).toHaveBeenCalledWith(
      restored!.doc,
      'page-1',
      page.document,
    )
    expect(board.sync).toBe(sync)
    expect(board.assetSource).toEqual({ kind: 'page', publicId: 'page-1' })
    expect(persistenceMocks.createRemotePage).not.toHaveBeenCalled()
  })
})
