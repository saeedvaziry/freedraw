import type { Arrowhead, ShapeType, StrokeStyle } from '../model/types.js'

export type Direction = 'TD' | 'TB' | 'LR' | 'RL' | 'BT'

export interface EdgeStyle {
  type: 'arrow' | 'line'
  startArrowhead: Arrowhead
  endArrowhead: Arrowhead
  strokeStyle: StrokeStyle
  thick: boolean
}

export interface AstNode {
  id: string
  shape: ShapeType
  text: string
}

export interface AstEdge {
  source: string
  target: string
  label?: string
  style: EdgeStyle
}

export interface DiagramAst {
  direction: Direction
  nodes: AstNode[]
  edges: AstEdge[]
}

export interface DiagramError {
  message: string
  line: number
  column: number
}
