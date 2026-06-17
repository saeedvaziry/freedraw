import type { Style } from '@freedraw/engine/model/types'
import type { LayoutOptions } from '@freedraw/engine/diagram'

export const defaultDiagramStyle: Partial<Style> = {
  sloppiness: 0,
  roundness: 0,
  fontSize: 14,
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
}

export const defaultDiagramLayout: LayoutOptions = {
  uniform: false,
  layerGap: 60,
  siblingGap: 48,
  minNodeSize: { width: 80, height: 40 },
}
