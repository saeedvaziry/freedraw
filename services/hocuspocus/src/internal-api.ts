import { createHash, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Extension, onRequestPayload } from '@hocuspocus/server'
import { foldPageState, restorePageState, type DocumentGateway } from './page-versions.js'
import type { PageStore } from './page-store.js'
import type { Logger } from './update-log-database.js'
import { base64ToBytes, bytesToBase64 } from './yjs-helpers.js'

const ROUTE_PATTERN = /^\/internal\/pages\/([^/]+)\/(fold|restore)$/

const DEFAULT_MAX_BODY_BYTES = 16 * 1024 * 1024

const noopLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

export type InternalOperation = 'fold' | 'restore'

export interface InternalRoute {
  room: string
  operation: InternalOperation
}

export interface InternalApiOptions {
  store: PageStore
  secret: string
  logger?: Logger
  maxBodyBytes?: number
}

export class InternalRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'InternalRequestError'
  }
}

export function matchInternalRoute(url: string): InternalRoute | null {
  const path = url.split('?')[0] ?? ''

  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return null
  }

  const match = ROUTE_PATTERN.exec(decoded)

  if (!match) {
    return null
  }

  return { room: match[1], operation: match[2] as InternalOperation }
}

export function secretMatches(provided: string, expected: string): boolean {
  if (expected.length === 0) {
    return false
  }

  const left = createHash('sha256').update(provided).digest()
  const right = createHash('sha256').update(expected).digest()

  return timingSafeEqual(left, right)
}

function bearerToken(request: IncomingMessage): string {
  const header = request.headers.authorization

  if (typeof header !== 'string' || !header.toLowerCase().startsWith('bearer ')) {
    return ''
  }

  return header.slice('bearer '.length).trim()
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)

  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

async function readJsonBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = chunk as Buffer
    size += buffer.length

    if (size > limit) {
      throw new InternalRequestError(413, 'payload too large')
    }

    chunks.push(buffer)
  }

  if (size === 0) {
    return null
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new InternalRequestError(400, 'malformed json body')
  }
}

function readState(body: unknown): Uint8Array {
  const state = (body as Record<string, unknown> | null)?.state

  if (typeof state !== 'string' || state.length === 0) {
    throw new InternalRequestError(422, 'a base64 state is required')
  }

  const bytes = base64ToBytes(state)

  if (bytes.length === 0) {
    throw new InternalRequestError(422, 'a base64 state is required')
  }

  return bytes
}

function handledByExtension(): Promise<never> {
  return Promise.reject()
}

export class InternalApi implements Partial<Extension> {
  public readonly extensionName = 'InternalApi'

  private readonly store: PageStore
  private readonly secret: string
  private readonly logger: Logger
  private readonly maxBodyBytes: number

  constructor(options: InternalApiOptions) {
    this.store = options.store
    this.secret = options.secret
    this.logger = options.logger ?? noopLogger
    this.maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  }

  async onRequest(data: onRequestPayload): Promise<void> {
    const route = matchInternalRoute(data.request.url ?? '')

    if (!route) {
      return
    }

    try {
      await this.dispatch(route, data.request, data.response, data.instance)
    } catch (error) {
      if (error instanceof InternalRequestError) {
        respond(data.response, error.status, { error: error.message })
      } else {
        this.logger.error('InternalApi: request failed', error)
        respond(data.response, 500, { error: 'internal error' })
      }
    }

    return handledByExtension()
  }

  private async dispatch(
    route: InternalRoute,
    request: IncomingMessage,
    response: ServerResponse,
    gateway: DocumentGateway,
  ): Promise<void> {
    if (request.method !== 'POST') {
      respond(response, 405, { error: 'method not allowed' })
      return
    }

    if (!secretMatches(bearerToken(request), this.secret)) {
      this.logger.warn('InternalApi: rejected an unauthenticated request', { room: route.room })
      respond(response, 401, { error: 'unauthorized' })
      return
    }

    const page = await this.store.findPageByRoom(route.room)

    if (!page) {
      respond(response, 404, { error: 'unknown room' })
      return
    }

    if (route.operation === 'fold') {
      const folded = await foldPageState(this.store, page.id, page.document)

      if (!folded) {
        respond(response, 404, { error: 'nothing to fold' })
        return
      }

      respond(response, 200, { state: bytesToBase64(folded.state), upToSeq: folded.upToSeq })
      return
    }

    const target = readState(await readJsonBody(request, this.maxBodyBytes))
    const restored = await restorePageState(gateway, this.store, route.room, page.id, target)

    this.logger.info('InternalApi: restored a page document', {
      room: route.room,
      upToSeq: restored.upToSeq,
    })

    respond(response, 200, { state: bytesToBase64(restored.state), upToSeq: restored.upToSeq })
  }
}
