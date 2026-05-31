export type BlobLoader = (assetId: string) => Promise<Blob | undefined>
export type BitmapDecoder = (blob: Blob) => Promise<ImageBitmap>
export type RepaintCallback = () => void

export interface ImageCacheConfig {
  loadBlob: BlobLoader
  decode?: BitmapDecoder
  onReady: RepaintCallback
}

const defaultDecode: BitmapDecoder = (blob) => createImageBitmap(blob)

export class ImageCache {
  private readonly bitmaps = new Map<string, ImageBitmap>()
  private readonly pending = new Map<string, Promise<void>>()
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

  set(assetId: string, bitmap: ImageBitmap): void {
    this.bitmaps.set(assetId, bitmap)
  }

  private requestDecode(assetId: string): void {
    if (this.pending.has(assetId)) return
    const task = this.load(assetId).finally(() => this.pending.delete(assetId))
    this.pending.set(assetId, task)
  }

  private async load(assetId: string): Promise<void> {
    const blob = await this.loadBlob(assetId)
    if (!blob) return
    const bitmap = await this.decode(blob)
    this.bitmaps.set(assetId, bitmap)
    this.onReady()
  }
}
