import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Extension, onAuthenticatePayload } from '@hocuspocus/server'

export interface RealtimeTokenClaims {
  room: string
  uid: number | null
  canEdit: boolean
  exp: number
}

export interface RealtimeAuthContext {
  readOnly: boolean
  uid: number | null
  room: string
}

export function verifyRealtimeToken(
  token: string,
  secret: string,
  room: string,
  now: number = Math.floor(Date.now() / 1000),
): RealtimeTokenClaims {
  if (secret.length === 0) {
    throw new Error('Realtime collaboration secret is not configured')
  }

  const parts = token.split('.')

  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    throw new Error('Malformed realtime token')
  }

  const [encodedPayload, encodedSignature] = parts
  const expected = createHmac('sha256', secret).update(encodedPayload).digest()
  const provided = Buffer.from(encodedSignature, 'base64url')

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error('Invalid realtime token signature')
  }

  const claims = decodeClaims(encodedPayload)

  if (!Number.isFinite(claims.exp) || now >= claims.exp) {
    throw new Error('Expired realtime token')
  }

  if (claims.room !== room) {
    throw new Error('Realtime token room mismatch')
  }

  return claims
}

function decodeClaims(encodedPayload: string): RealtimeTokenClaims {
  let parsed: unknown

  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Malformed realtime token payload')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Malformed realtime token payload')
  }

  const { room, uid, canEdit, exp } = parsed as Record<string, unknown>

  if (typeof room !== 'string' || typeof canEdit !== 'boolean' || typeof exp !== 'number') {
    throw new Error('Malformed realtime token payload')
  }

  if (uid !== null && typeof uid !== 'number') {
    throw new Error('Malformed realtime token payload')
  }

  return { room, uid, canEdit, exp }
}

export class RealtimeAuth implements Extension {
  extensionName = 'RealtimeAuth'

  constructor(private readonly secret: string) {}

  async onAuthenticate(data: onAuthenticatePayload): Promise<RealtimeAuthContext> {
    const claims = verifyRealtimeToken(data.token, this.secret, data.documentName)
    const readOnly = !claims.canEdit

    data.connectionConfig.readOnly = readOnly

    return {
      readOnly,
      uid: claims.uid,
      room: claims.room,
    }
  }
}
