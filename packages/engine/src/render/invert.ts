const HEX_SHORT = /^#([\da-f])([\da-f])([\da-f])$/i
const HEX_LONG = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i

interface Rgb {
  r: number
  g: number
  b: number
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l }

  const s = delta / (1 - Math.abs(2 * l - 1))
  const h =
    max === rn
      ? ((gn - bn) / delta) % 6
      : max === gn
        ? (bn - rn) / delta + 2
        : (rn - gn) / delta + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

function invertRgb(color: Rgb): Rgb {
  const { h, s, l } = rgbToHsl(color)
  return hslToRgb(h, s, 1 - l)
}

function toHex({ r, g, b }: Rgb): string {
  const part = (channel: number): string => channel.toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

export function invertColor(css: string): string {
  if (css === 'transparent') return css

  const long = HEX_LONG.exec(css)
  if (long) {
    return toHex(
      invertRgb({
        r: parseInt(long[1]!, 16),
        g: parseInt(long[2]!, 16),
        b: parseInt(long[3]!, 16),
      }),
    )
  }

  const short = HEX_SHORT.exec(css)
  if (short) {
    const expand = (part: string): number => parseInt(part + part, 16)
    return toHex(invertRgb({ r: expand(short[1]!), g: expand(short[2]!), b: expand(short[3]!) }))
  }

  const rgb = RGB.exec(css)
  if (rgb) {
    const { r, g, b } = invertRgb({
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    })
    const alpha = rgb[4]
    return alpha === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number(alpha)})`
  }

  return css
}

const INVERTED_PROPERTIES = new Set(['fillStyle', 'strokeStyle'])

export function invertingContext(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return new Proxy(ctx, {
    get(target, property) {
      const value = target[property as keyof CanvasRenderingContext2D]
      return typeof value === 'function' ? value.bind(target) : value
    },
    set(target, property, value) {
      const next =
        typeof property === 'string' &&
        INVERTED_PROPERTIES.has(property) &&
        typeof value === 'string'
          ? invertColor(value)
          : value
      Reflect.set(target, property, next)
      return true
    },
  })
}
