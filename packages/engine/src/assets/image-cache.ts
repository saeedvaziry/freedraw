export type BlobLoader = (assetId: string) => Promise<Blob | undefined>
export type BitmapDecoder = (blob: Blob) => Promise<ImageBitmap>
export type RepaintCallback = () => void

export interface ImageCacheConfig {
  loadBlob: BlobLoader
  decode?: BitmapDecoder
  onReady: RepaintCallback
}

interface ImageSource {
  mime: string
  bytes: Uint8Array
}

const defaultDecode: BitmapDecoder = (blob) => createImageBitmap(blob)

export class ImageCache {
  private readonly bitmaps = new Map<string, ImageBitmap>()
  private readonly sources = new Map<string, ImageSource>()
  private readonly pending = new Map<string, Promise<void>>()
  private readonly pendingSources = new Map<string, Promise<void>>()
  private readonly loadBlob: BlobLoader
  private readonly decode: BitmapDecoder
  private readonly onReady: RepaintCallback

  constructor(config: ImageCacheConfig) {
    this.loadBlob = config.loadBlob
    this.decode = config.decode ?? defaultDecode
    this.onReady = config.onReady
  }

  getBitmap(assetId: string): ImageBitmap | undefined {
    const cached = this.bitmaps.get(assetId)
    if (cached) return cached
    this.requestDecode(assetId)
    return undefined
  }

  getSourceDataUrl(assetId: string): string | undefined {
    const source = this.sources.get(assetId)
    if (!source) return undefined
    const base64 = encodeBase64(source.bytes)
    if (base64 === undefined) return undefined
    return `data:${source.mime};base64,${base64}`
  }

  set(assetId: string, bitmap: ImageBitmap, source?: Blob): void {
    this.bitmaps.set(assetId, bitmap)
    if (source) void this.rememberSource(assetId, source)
  }

  async ensureBitmaps(assetIds: Iterable<string>): Promise<void> {
    const tasks = [...assetIds].map((assetId) =>
      this.bitmaps.has(assetId) ? Promise.resolve() : this.schedule(assetId),
    )
    await Promise.all(tasks)
  }

  async ensureSources(assetIds: Iterable<string>): Promise<void> {
    const tasks = [...assetIds].map((assetId) => {
      if (this.sources.has(assetId)) return Promise.resolve()
      return this.pendingSources.get(assetId) ?? this.schedule(assetId)
    })
    await Promise.all(tasks)
  }

  private requestDecode(assetId: string): void {
    if (this.pending.has(assetId)) return
    void this.schedule(assetId)
  }

  private schedule(assetId: string): Promise<void> {
    const existing = this.pending.get(assetId)
    if (existing) return existing
    const task = this.load(assetId).finally(() => this.pending.delete(assetId))
    this.pending.set(assetId, task)
    return task
  }

  private async load(assetId: string): Promise<void> {
    const blob = await this.loadBlob(assetId)
    if (!blob) return
    await this.rememberSource(assetId, blob)
    if (this.bitmaps.has(assetId)) return
    const bitmap = await this.decode(blob)
    this.bitmaps.set(assetId, bitmap)
    this.onReady()
  }

  private rememberSource(assetId: string, blob: Blob): Promise<void> {
    if (this.sources.has(assetId)) return Promise.resolve()
    const existing = this.pendingSources.get(assetId)
    if (existing) return existing
    if (!blob.type.startsWith('image/')) return Promise.resolve()
    if (typeof blob.arrayBuffer !== 'function') return Promise.resolve()
    const task = blob
      .arrayBuffer()
      .then((buffer) => {
        this.sources.set(assetId, { mime: blob.type, bytes: new Uint8Array(buffer) })
      })
      .catch(() => undefined)
      .finally(() => this.pendingSources.delete(assetId))
    this.pendingSources.set(assetId, task)
    return task
  }
}

const BASE64_CHUNK = 0x8000

function encodeBase64(bytes: Uint8Array): string | undefined {
  if (typeof btoa !== 'function') return undefined
  let binary = ''
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK))
  }
  return btoa(binary)
}
