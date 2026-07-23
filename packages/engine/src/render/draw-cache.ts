import type { Drawable } from 'roughjs/bin/core.js'

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

export class DrawableCache extends KeyedCache<Drawable> {}
export class StrokeCache extends KeyedCache<number[][]> {}

export const drawableCache = new DrawableCache()
export const strokeCache = new StrokeCache()

export function sweepDrawCaches(live: ReadonlySet<string>): void {
  drawableCache.sweep(live)
  strokeCache.sweep(live)
}

export function clearDrawCaches(): void {
  drawableCache.clear()
  strokeCache.clear()
}
