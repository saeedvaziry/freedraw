import type { CameraState, LocalAppState, SceneStore, Style } from '@freedraw/engine'
import type { AssetSource } from './asset-loader.js'

const VIEWPORT_PREFIX = 'freedraw:viewport:'

export function viewportKeyFor(source: AssetSource): string | null {
  if (source.kind === 'page') return `${VIEWPORT_PREFIX}page:${source.publicId}`
  if (source.kind === 'local') return `${VIEWPORT_PREFIX}local`
  return null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function readCamera(value: unknown): CameraState | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (!isFiniteNumber(record.x) || !isFiniteNumber(record.y) || !isFiniteNumber(record.zoom)) {
    return undefined
  }
  return { x: record.x, y: record.y, zoom: record.zoom }
}

function readStyle(value: unknown): Style | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  return typeof (value as Record<string, unknown>).stroke === 'string' ? (value as Style) : undefined
}

function parseSaved(raw: string): Partial<LocalAppState> | null {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  const next: Partial<LocalAppState> = {}
  const camera = readCamera(record.camera)
  if (camera) next.camera = camera
  const lastUsedStyle = readStyle(record.lastUsedStyle)
  if (lastUsedStyle) next.lastUsedStyle = lastUsedStyle
  if (typeof record.snapGuidesEnabled === 'boolean') next.snapGuidesEnabled = record.snapGuidesEnabled
  return Object.keys(next).length > 0 ? next : null
}

export function attachViewportPersistence(store: SceneStore, source: AssetSource): () => void {
  const key = viewportKeyFor(source)
  if (!key) return () => {}

  try {
    const raw = localStorage.getItem(key)
    const saved = raw ? parseSaved(raw) : null
    if (saved) store.hydrateLocalAppState(saved)
  } catch {
    return () => {}
  }

  return store.subscribeLocalState(() => {
    try {
      localStorage.setItem(key, JSON.stringify(store.getLocalAppState()))
    } catch {
      return
    }
  })
}
