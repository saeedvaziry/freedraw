import { normalizeHex, rgbToHex } from './color.js'

interface EyeDropperResult {
  sRGBHex: string
}

interface EyeDropperLike {
  open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>
}

type EyeDropperConstructor = new () => EyeDropperLike

function nativeEyeDropper(): EyeDropperConstructor | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper
  return typeof ctor === 'function' ? ctor : null
}

export function supportsNativeEyeDropper(): boolean {
  return nativeEyeDropper() !== null
}

export async function pickWithNativeEyeDropper(): Promise<string | null> {
  const Constructor = nativeEyeDropper()
  if (!Constructor) return null
  try {
    const result = await new Constructor().open()
    return normalizeHex(result.sRGBHex)
  } catch {
    return null
  }
}

function isCanvas(element: Element): element is HTMLCanvasElement {
  return element instanceof HTMLCanvasElement
}

export function sceneCanvasAt(clientX: number, clientY: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  if (typeof document.elementsFromPoint !== 'function') return null
  const canvases = document.elementsFromPoint(clientX, clientY).filter(isCanvas)
  return canvases[canvases.length - 1] ?? null
}

export function sampleColorAt(clientX: number, clientY: number): string | null {
  const canvas = sceneCanvasAt(clientX, clientY)
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width)
  const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height)
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null
  try {
    const data = ctx.getImageData(x, y, 1, 1).data
    if ((data[3] ?? 0) === 0) return null
    return rgbToHex(data[0] ?? 0, data[1] ?? 0, data[2] ?? 0)
  } catch {
    return null
  }
}

export interface EyeDropperSession {
  cancel(): void
}

export interface CanvasEyeDropperHandlers {
  onPick(color: string): void
  onPreview?(color: string | null): void
  onCancel?(): void
}

const NOOP_SESSION: EyeDropperSession = { cancel: () => undefined }

export function startCanvasEyeDropper(handlers: CanvasEyeDropperHandlers): EyeDropperSession {
  if (typeof window === 'undefined') return NOOP_SESSION

  let active = true

  const stop = (): void => {
    if (!active) return
    active = false
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerdown', onDown, true)
    window.removeEventListener('keydown', onKey, true)
  }

  const onMove = (event: PointerEvent): void => {
    handlers.onPreview?.(sampleColorAt(event.clientX, event.clientY))
  }

  const onDown = (event: PointerEvent): void => {
    const color = sampleColorAt(event.clientX, event.clientY)
    event.preventDefault()
    event.stopPropagation()
    stop()
    if (color) {
      handlers.onPick(color)
      return
    }
    handlers.onCancel?.()
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    stop()
    handlers.onCancel?.()
  }

  window.addEventListener('pointermove', onMove, true)
  window.addEventListener('pointerdown', onDown, true)
  window.addEventListener('keydown', onKey, true)

  return {
    cancel: () => {
      if (!active) return
      stop()
      handlers.onCancel?.()
    },
  }
}
