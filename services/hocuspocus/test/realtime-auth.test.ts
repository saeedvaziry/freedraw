import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { onAuthenticatePayload } from '@hocuspocus/server'
import { RealtimeAuth, verifyRealtimeToken } from '../src/realtime-auth.js'

const SECRET = 'test-collab-secret'

interface TokenClaims {
  room: string
  uid: number | null
  canEdit: boolean
  exp: number
}

function sign(claims: TokenClaims, secret: string = SECRET): string {
  const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

function claims(overrides: Partial<TokenClaims> = {}): TokenClaims {
  return {
    room: 'room-1',
    uid: 42,
    canEdit: true,
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  }
}

function authPayload(token: string, documentName: string): onAuthenticatePayload {
  return {
    token,
    documentName,
    connectionConfig: { readOnly: false, isAuthenticated: false },
  } as unknown as onAuthenticatePayload
}

describe('verifyRealtimeToken', () => {
  it('accepts a valid token and returns its claims', () => {
    const token = sign(claims())

    expect(verifyRealtimeToken(token, SECRET, 'room-1')).toEqual(claims())
  })

  it('rejects an expired token', () => {
    const token = sign(claims({ exp: Math.floor(Date.now() / 1000) - 1 }))

    expect(() => verifyRealtimeToken(token, SECRET, 'room-1')).toThrow(/expired/i)
  })

  it('rejects a token whose room does not match the requested document', () => {
    const token = sign(claims({ room: 'other-room' }))

    expect(() => verifyRealtimeToken(token, SECRET, 'room-1')).toThrow(/room mismatch/i)
  })

  it('rejects a token signed with the wrong secret', () => {
    const token = sign(claims(), 'wrong-secret')

    expect(() => verifyRealtimeToken(token, SECRET, 'room-1')).toThrow(/signature/i)
  })

  it('rejects a token whose payload was tampered with', () => {
    const original = sign(claims({ canEdit: false }))
    const [, signature] = original.split('.')
    const forgedPayload = Buffer.from(JSON.stringify(claims({ canEdit: true }))).toString('base64url')
    const forged = `${forgedPayload}.${signature}`

    expect(() => verifyRealtimeToken(forged, SECRET, 'room-1')).toThrow(/signature/i)
  })

  it('rejects a malformed token', () => {
    expect(() => verifyRealtimeToken('not-a-token', SECRET, 'room-1')).toThrow(/malformed/i)
  })

  it('rejects verification when no secret is configured', () => {
    const token = sign(claims())

    expect(() => verifyRealtimeToken(token, '', 'room-1')).toThrow(/not configured/i)
  })
})

describe('RealtimeAuth extension', () => {
  it('authenticates an editor with a writable connection', async () => {
    const payload = authPayload(sign(claims({ canEdit: true })), 'room-1')

    const context = await new RealtimeAuth(SECRET).onAuthenticate(payload)

    expect(context).toEqual({ readOnly: false, uid: 42, room: 'room-1' })
    expect(payload.connectionConfig.readOnly).toBe(false)
  })

  it('marks a viewer connection read-only', async () => {
    const payload = authPayload(sign(claims({ canEdit: false, uid: null })), 'room-1')

    const context = await new RealtimeAuth(SECRET).onAuthenticate(payload)

    expect(context).toEqual({ readOnly: true, uid: null, room: 'room-1' })
    expect(payload.connectionConfig.readOnly).toBe(true)
  })

  it('rejects a connection to a different room', async () => {
    const payload = authPayload(sign(claims({ room: 'room-1' })), 'room-2')

    await expect(new RealtimeAuth(SECRET).onAuthenticate(payload)).rejects.toThrow(/room mismatch/i)
  })
})
