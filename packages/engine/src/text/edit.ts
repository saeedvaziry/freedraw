import type { ElementId, Style } from '../model/types.js'

export type EditTarget = 'text' | 'label'

export interface EditRequest {
  elementId: ElementId
  target: EditTarget
  text: string
  world: { x: number; y: number; width: number; height: number }
  style: Style
  align: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
  selectAll?: boolean
}

export type EditListener = (request: EditRequest | null) => void
