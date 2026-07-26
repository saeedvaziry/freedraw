export const TRANSPARENT = 'transparent'

const SHORT_HEX = /^#?([\da-f]{3})$/i
const LONG_HEX = /^#?([\da-f]{6})$/i

export function normalizeHex(value: string): string | null {
  const input = value.trim()
  const short = SHORT_HEX.exec(input)
  if (short) {
    const digits = short[1]!.toLowerCase()
    return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`
  }
  const long = LONG_HEX.exec(input)
  if (long) return `#${long[1]!.toLowerCase()}`
  return null
}

export function isTransparentKeyword(value: string): boolean {
  const input = value.trim().toLowerCase()
  return input === TRANSPARENT || input === 'none'
}

export function contrastColor(value: string): string {
  const hex = normalizeHex(value)
  if (!hex) return '#1e1e1e'
  const int = parseInt(hex.slice(1), 16)
  const r = (int >> 16) & 0xff
  const g = (int >> 8) & 0xff
  const b = int & 0xff
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#1e1e1e' : '#ffffff'
}

export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function displayColor(value: string): string {
  if (isTransparentKeyword(value)) return 'None'
  return (normalizeHex(value) ?? value).toUpperCase()
}
