import { layoutText, type TextLayout, type TextLayoutInput } from './layout.js'
import type { MeasureContext } from './measure.js'

export function layoutKey(input: TextLayoutInput): string {
  return [
    input.text,
    Math.round(input.width),
    input.fontSize,
    input.fontFamily,
    input.lineHeight ?? '',
  ].join('|')
}

export class LayoutCache {
  private readonly entries = new Map<string, { key: string; layout: TextLayout }>()

  get(id: string, input: TextLayoutInput, measure: MeasureContext): TextLayout {
    const key = layoutKey(input)
    const cached = this.entries.get(id)
    if (cached && cached.key === key) return cached.layout
    const layout = layoutText(input, measure)
    this.entries.set(id, { key, layout })
    return layout
  }

  invalidate(id: string): void {
    this.entries.delete(id)
  }

  clear(): void {
    this.entries.clear()
  }

  get size(): number {
    return this.entries.size
  }
}
