import { defaultStyle } from '../model/schema.js'
import type { Element, ElementId, Point, Style } from '../model/types.js'
import type { DiagramError, Direction } from './ast.js'
import { buildElements } from './build.js'
import { layoutDiagram } from './layout.js'
import { parse } from './parse.js'

export interface ParseOptions {
  direction?: Direction
  origin?: Point
  style?: Partial<Style>
}

export interface DiagramParseResult {
  elements: Element[]
  order: ElementId[]
  errors: DiagramError[]
}

export function parseDiagram(text: string, options: ParseOptions = {}): DiagramParseResult {
  const { ast, errors } = parse(text)
  if (errors.length > 0) return { elements: [], order: [], errors }

  const direction = options.direction ?? ast.direction
  const style: Style = { ...defaultStyle, ...options.style }
  const layout = layoutDiagram({ ...ast, direction }, options.origin, style)
  const { elements, order } = buildElements({ ...ast, direction }, layout, style)
  return { elements, order, errors }
}

export { serializeDiagram } from './serialize.js'
export type { SerializeReport } from './serialize.js'
export { parse } from './parse.js'
export type { ParseResult } from './parse.js'
export { layoutDiagram } from './layout.js'
export type { LayoutResult, NodeBox } from './layout.js'
export { buildElements } from './build.js'
export type { BuildResult } from './build.js'
export type { DiagramAst, AstNode, AstEdge, EdgeStyle, Direction, DiagramError } from './ast.js'
