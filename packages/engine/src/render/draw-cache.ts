import type { Drawable } from 'roughjs/bin/core.js'
import type { Element } from '../model/types.js'
import { invertColor } from './invert.js'

class KeyedCache<V> {
  private readonly entries = new Map<string, { key: string; value: V }>()

  get(id: string, key: string, make: () => V): V {
    const cached = this.entries.get(id)
    if (cached && cached.key === key) return cached.value
    const value = make()
    this.entries.set(id, { key, value })
    return value
  }

  invalidate(id: string): void {
    this.entries.delete(id)
  }

  sweep(live: ReadonlySet<string>): void {
    for (const id of this.entries.keys()) {
      if (!live.has(id)) this.entries.delete(id)
    }
  }

  clear(): void {
    this.entries.clear()
  }

  get size(): number {
    return this.entries.size
  }
}

export interface ElementColors {
  stroke: string
  fill: string
  textColor: string
}

export class DrawableCache extends KeyedCache<Drawable> {}
export class StrokeCache extends KeyedCache<number[][]> {}
export class ColorCache extends KeyedCache<ElementColors> {}

export const drawableCache = new DrawableCache()
export const strokeCache = new StrokeCache()
export const colorCache = new ColorCache()

export function elementColors(element: Element, dark: boolean): ElementColors {
  const { stroke, fill, textColor } = element.style
  if (!dark) return { stroke, fill, textColor }
  return colorCache.get(element.id, `${stroke}|${fill}|${textColor}`, () => ({
    stroke: invertColor(stroke),
    fill: invertColor(fill),
    textColor: invertColor(textColor),
  }))
}

export function sweepDrawCaches(live: ReadonlySet<string>): void {
  drawableCache.sweep(live)
  strokeCache.sweep(live)
  colorCache.sweep(live)
}

export function clearDrawCaches(): void {
  drawableCache.clear()
  strokeCache.clear()
  colorCache.clear()
}
