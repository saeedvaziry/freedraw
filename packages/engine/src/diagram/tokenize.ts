import type { DiagramError } from './ast.js'
import { EDGE_OPERATORS, SHAPE_OPENERS, type EdgeToken, type ShapeToken } from './tokens.js'

export interface NodeRefToken {
  kind: 'node'
  id: string
  shape?: ShapeToken
  text?: string
  column: number
}

export interface EdgeOpToken {
  kind: 'edge'
  op: EdgeToken
  label?: string
  column: number
}

export type LineToken = NodeRefToken | EdgeOpToken

export interface TokenizeLineResult {
  tokens: LineToken[]
  error?: DiagramError
}

const ID_PATTERN = /[A-Za-z0-9_]/

export function tokenizeLine(line: string, lineNumber: number): TokenizeLineResult {
  const tokens: LineToken[] = []
  let index = 0

  while (index < line.length) {
    const char = line[index]!
    if (char === ' ' || char === '\t') {
      index += 1
      continue
    }

    const edge = matchEdge(line, index)
    if (edge) {
      const labeled = readPipeLabel(line, edge.next, edge.token, lineNumber)
      if ('error' in labeled) return { tokens, error: labeled.error }
      tokens.push(labeled.token)
      index = labeled.next
      continue
    }

    if (!ID_PATTERN.test(char)) {
      return { tokens, error: error(`Unexpected character "${char}"`, lineNumber, index) }
    }

    const node = matchNode(line, index, lineNumber)
    if ('error' in node) return { tokens, error: node.error }
    tokens.push(node.token)
    index = node.next
  }

  return { tokens }
}

function matchEdge(line: string, index: number): { token: EdgeOpToken; next: number } | null {
  const opener = EDGE_OPERATORS.find((op) => line.startsWith(op.text, index))
  if (!opener) return inlineEdge(line, index)
  return { token: { kind: 'edge', op: opener, column: index }, next: index + opener.text.length }
}

function inlineEdge(line: string, index: number): { token: EdgeOpToken; next: number } | null {
  for (const kind of INLINE_LINE_KINDS) {
    if (!line.startsWith(kind.prefix, index)) continue
    const tailStart = line.indexOf(kind.tail, index + kind.prefix.length)
    if (tailStart < 0) continue
    const label = line.slice(index + kind.prefix.length, tailStart).trim()
    const token = EDGE_OPERATORS.find((edge) => edge.text === kind.operator)
    if (!token) continue
    return { token: { kind: 'edge', op: token, label, column: index }, next: tailStart + kind.tail.length }
  }
  return null
}

const INLINE_LINE_KINDS = [
  { prefix: '-- ', tail: '-->', operator: '-->' },
  { prefix: '-- ', tail: '---', operator: '---' },
  { prefix: '== ', tail: '==>', operator: '==>' },
]

function readPipeLabel(
  line: string,
  index: number,
  token: EdgeOpToken,
  lineNumber: number,
): { token: EdgeOpToken; next: number } | { error: DiagramError } {
  let cursor = index
  while (cursor < line.length && (line[cursor] === ' ' || line[cursor] === '\t')) cursor += 1
  if (line[cursor] !== '|') return { token, next: index }
  const closeAt = line.indexOf('|', cursor + 1)
  if (closeAt < 0) return { error: error('Unterminated edge label', lineNumber, cursor) }
  return { token: { ...token, label: line.slice(cursor + 1, closeAt).trim() }, next: closeAt + 1 }
}

function matchNode(
  line: string,
  index: number,
  lineNumber: number,
): { token: NodeRefToken; next: number } | { error: DiagramError } {
  const start = index
  let cursor = index
  while (cursor < line.length && ID_PATTERN.test(line[cursor]!)) cursor += 1
  const id = line.slice(start, cursor)

  const shape = SHAPE_OPENERS.find((token) => line.startsWith(token.open, cursor))
  if (!shape) return { token: { kind: 'node', id, column: start }, next: cursor }

  const body = readShapeBody(line, cursor + shape.open.length, shape, lineNumber)
  if ('error' in body) return body
  return { token: { kind: 'node', id, shape, text: body.text, column: start }, next: body.next }
}

function readShapeBody(
  line: string,
  index: number,
  shape: ShapeToken,
  lineNumber: number,
): { text: string; next: number } | { error: DiagramError } {
  if (line[index] === '"') return readQuoted(line, index + 1, shape, lineNumber)
  const closeAt = line.indexOf(shape.close, index)
  if (closeAt < 0) return { error: error(`Unterminated "${shape.open}"`, lineNumber, index) }
  return { text: line.slice(index, closeAt).trim(), next: closeAt + shape.close.length }
}

function readQuoted(
  line: string,
  index: number,
  shape: ShapeToken,
  lineNumber: number,
): { text: string; next: number } | { error: DiagramError } {
  const quoteAt = line.indexOf('"', index)
  if (quoteAt < 0) return { error: error('Unterminated quote', lineNumber, index) }
  if (!line.startsWith(shape.close, quoteAt + 1)) {
    return { error: error(`Unterminated "${shape.open}"`, lineNumber, quoteAt + 1) }
  }
  return { text: line.slice(index, quoteAt), next: quoteAt + 1 + shape.close.length }
}

function error(message: string, line: number, column: number): DiagramError {
  return { message, line, column }
}
