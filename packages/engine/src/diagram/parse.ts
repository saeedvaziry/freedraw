import type { AstEdge, AstNode, DiagramAst, DiagramError, Direction } from './ast.js'
import { tokenizeLine, type EdgeOpToken, type LineToken, type NodeRefToken } from './tokenize.js'
import {
  DEFAULT_DIRECTION,
  DEFAULT_SHAPE,
  DIRECTIONS,
  HEADER_KEYWORDS,
  edgeStyleFromToken,
} from './tokens.js'

export interface ParseResult {
  ast: DiagramAst
  errors: DiagramError[]
}

export function parse(text: string): ParseResult {
  const lines = text.split('\n')
  const errors: DiagramError[] = []
  const nodes = new Map<string, AstNode>()
  const edges: AstEdge[] = []
  let direction = DEFAULT_DIRECTION

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]!
    const lineNumber = i + 1
    const trimmed = stripStatement(raw)
    if (trimmed.length === 0) continue

    const header = readHeader(trimmed)
    if (header) {
      direction = header
      continue
    }

    const { tokens, error } = tokenizeLine(trimmed, lineNumber)
    if (error) {
      errors.push(error)
      continue
    }
    const lineError = consume(tokens, lineNumber, nodes, edges)
    if (lineError) errors.push(lineError)
  }

  return { ast: { direction, nodes: [...nodes.values()], edges }, errors }
}

function stripStatement(line: string): string {
  const withoutComment = line.split('%%')[0] ?? ''
  return withoutComment.replace(/;\s*$/, '').trim()
}

function readHeader(line: string): Direction | null {
  const parts = line.split(/\s+/)
  const keyword = parts[0]?.toLowerCase()
  if (!keyword || !HEADER_KEYWORDS.includes(keyword)) return null
  const direction = parts[1]?.toUpperCase()
  if (direction && DIRECTIONS.includes(direction as Direction)) return direction as Direction
  return DEFAULT_DIRECTION
}

function consume(
  tokens: LineToken[],
  lineNumber: number,
  nodes: Map<string, AstNode>,
  edges: AstEdge[],
): DiagramError | null {
  if (tokens.length === 0) return null
  const first = tokens[0]!
  if (first.kind !== 'node') return error('Expected a node', lineNumber, first.column)

  registerNode(first, nodes)
  let previous = first.id
  let cursor = 1

  while (cursor < tokens.length) {
    const op = tokens[cursor]
    if (!op || op.kind !== 'edge') return error('Expected an edge operator', lineNumber, op?.column ?? 0)
    const target = tokens[cursor + 1]
    if (!target || target.kind !== 'node') return error('Edge is missing a target node', lineNumber, op.column)

    registerNode(target, nodes)
    edges.push(buildEdge(previous, target.id, op))
    previous = target.id
    cursor += 2
  }

  return null
}

function registerNode(token: NodeRefToken, nodes: Map<string, AstNode>): void {
  const existing = nodes.get(token.id)
  if (!existing) {
    nodes.set(token.id, {
      id: token.id,
      shape: token.shape?.shape ?? DEFAULT_SHAPE,
      text: token.text ?? token.id,
    })
    return
  }
  if (token.shape) existing.shape = token.shape.shape
  if (token.text !== undefined) existing.text = token.text
}

function buildEdge(source: string, target: string, op: EdgeOpToken): AstEdge {
  return {
    source,
    target,
    label: op.label && op.label.length > 0 ? op.label : undefined,
    style: edgeStyleFromToken(op.op),
  }
}

function error(message: string, line: number, column: number): DiagramError {
  return { message, line, column }
}
