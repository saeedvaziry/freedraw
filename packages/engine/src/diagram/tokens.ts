import type { ShapeType } from '../model/types.js'
import type { Direction, EdgeStyle } from './ast.js'

export interface ShapeToken {
  open: string
  close: string
  shape: ShapeType
  canonical: boolean
}

export const SHAPE_TOKENS: ShapeToken[] = [
  { open: '([', close: '])', shape: 'roundRect', canonical: false },
  { open: '[(', close: ')]', shape: 'cylinder', canonical: true },
  { open: '[/', close: '/]', shape: 'parallelogram', canonical: true },
  { open: '((', close: '))', shape: 'ellipse', canonical: true },
  { open: '{{', close: '}}', shape: 'hexagon', canonical: true },
  { open: '[', close: ']', shape: 'rect', canonical: true },
  { open: '(', close: ')', shape: 'roundRect', canonical: true },
  { open: '{', close: '}', shape: 'diamond', canonical: true },
  { open: '>', close: ']', shape: 'triangle', canonical: true },
]

export const SHAPE_OPENERS = [...SHAPE_TOKENS].sort((a, b) => b.open.length - a.open.length)

export const DEFAULT_SHAPE: ShapeType = 'rect'

export function canonicalShapeToken(shape: ShapeType): ShapeToken {
  return SHAPE_TOKENS.find((token) => token.shape === shape && token.canonical) ?? SHAPE_TOKENS[5]!
}

export interface EdgeToken {
  text: string
  line: 'solid' | 'dotted' | 'thick'
  startArrowhead: EdgeStyle['startArrowhead']
  endArrowhead: EdgeStyle['endArrowhead']
}

export const EDGE_TOKENS: EdgeToken[] = [
  { text: '<-->', line: 'solid', startArrowhead: 'triangle', endArrowhead: 'triangle' },
  { text: '-.->', line: 'dotted', startArrowhead: 'none', endArrowhead: 'triangle' },
  { text: '==>', line: 'thick', startArrowhead: 'none', endArrowhead: 'triangle' },
  { text: '-->', line: 'solid', startArrowhead: 'none', endArrowhead: 'triangle' },
  { text: '--o', line: 'solid', startArrowhead: 'none', endArrowhead: 'dot' },
  { text: '--x', line: 'solid', startArrowhead: 'none', endArrowhead: 'bar' },
  { text: '---', line: 'solid', startArrowhead: 'none', endArrowhead: 'none' },
]

export const EDGE_OPERATORS = [...EDGE_TOKENS].sort((a, b) => b.text.length - a.text.length)

export function edgeStyleFromToken(token: EdgeToken): EdgeStyle {
  return {
    type: token.endArrowhead === 'none' && token.startArrowhead === 'none' ? 'line' : 'arrow',
    startArrowhead: token.startArrowhead,
    endArrowhead: token.endArrowhead,
    strokeStyle: token.line === 'dotted' ? 'dotted' : 'solid',
    thick: token.line === 'thick',
  }
}

export function canonicalEdgeToken(style: EdgeStyle): EdgeToken {
  return (
    EDGE_TOKENS.find(
      (token) =>
        edgeMatches(token, style),
    ) ?? EDGE_TOKENS[3]!
  )
}

function edgeMatches(token: EdgeToken, style: EdgeStyle): boolean {
  const tokenStyle = edgeStyleFromToken(token)
  return (
    tokenStyle.startArrowhead === style.startArrowhead &&
    tokenStyle.endArrowhead === style.endArrowhead &&
    tokenStyle.strokeStyle === style.strokeStyle &&
    tokenStyle.thick === style.thick
  )
}

export const DIRECTIONS: Direction[] = ['TD', 'TB', 'LR', 'RL', 'BT']

export const DEFAULT_DIRECTION: Direction = 'TD'

export const HEADER_KEYWORDS = ['flowchart', 'graph']
