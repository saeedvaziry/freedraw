import { isTransparentKeyword, normalizeHex } from './color.js'

export const RECENT_COLORS_KEY = 'freedraw:recent-colors'
export const MAX_RECENT_COLORS = 8

export function rememberColor(colors: readonly string[], value: string): string[] {
  if (isTransparentKeyword(value)) return [...colors]
  const hex = normalizeHex(value)
  if (!hex) return [...colors]
  const next = [hex, ...colors.filter((color) => color !== hex)]
  return next.slice(0, MAX_RECENT_COLORS)
}

export function readRecentColors(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_COLORS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const colors: string[] = []
    for (const entry of parsed) {
      if (typeof entry !== 'string') continue
      const hex = normalizeHex(entry)
      if (hex && !colors.includes(hex)) colors.push(hex)
      if (colors.length >= MAX_RECENT_COLORS) break
    }
    return colors
  } catch {
    return []
  }
}

export function writeRecentColors(colors: readonly string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify([...colors]))
  } catch {
    return
  }
}
