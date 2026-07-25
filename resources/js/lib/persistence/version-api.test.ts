import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isCsrfExpired, PageRequestError } from './page-api.js'
import {
  createPageVersion,
  fetchPageVersion,
  fetchPageVersions,
  restorePageVersion,
  VersionRequestError,
} from './version-api.js'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function htmlResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token <')
    },
  } as unknown as Response
}

const VERSION = {
  id: 7,
  label: 'Before the redesign',
  upToSeq: 42,
  createdAt: '2026-07-01T10:00:00.000Z',
  creator: { id: 3, name: 'Ada' },
}

let fetchMock: ReturnType<typeof vi.fn>

function lastInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit
}

function lastHeaders(): Record<string, string> {
  return lastInit().headers as Record<string, string>
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token%20value'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('fetchPageVersions', () => {
  it('gets the labeled versions for a page', async () => {
    fetchMock.mockResolvedValue(jsonResponse([VERSION]))

    await expect(fetchPageVersions('abc123')).resolves.toEqual([VERSION])
    expect(fetchMock.mock.calls[0][0]).toBe('/pages/abc123/versions')
    expect(lastInit().method).toBe('GET')
  })

  it('url-encodes the page identifier', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await fetchPageVersions('a/b c')

    expect(fetchMock.mock.calls[0][0]).toBe('/pages/a%2Fb%20c/versions')
  })

  it('asks for json so web routes do not answer with html', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await fetchPageVersions('abc123')

    expect(lastHeaders().Accept).toBe('application/json')
    expect(lastHeaders()['X-Requested-With']).toBe('XMLHttpRequest')
    expect(lastInit().credentials).toBe('same-origin')
  })
})

describe('fetchPageVersion', () => {
  it('gets a single version including its encoded state', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...VERSION, state: 'AQID' }))

    const version = await fetchPageVersion('abc123', 7)

    expect(version.state).toBe('AQID')
    expect(fetchMock.mock.calls[0][0]).toBe('/pages/abc123/versions/7')
    expect(lastInit().method).toBe('GET')
  })
})

describe('createPageVersion', () => {
  it('posts the label with the rotating csrf token', async () => {
    fetchMock.mockResolvedValue(jsonResponse(VERSION, 201))

    await expect(createPageVersion('abc123', 'Before the redesign')).resolves.toEqual(VERSION)
    expect(fetchMock.mock.calls[0][0]).toBe('/pages/abc123/versions')
    expect(lastInit().method).toBe('POST')
    expect(lastInit().body).toBe(JSON.stringify({ label: 'Before the redesign' }))
    expect(lastHeaders()['X-XSRF-TOKEN']).toBe('token value')
  })

  it('surfaces the server message on a 422', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'no snapshot to label yet' }, 422))

    const error = await createPageVersion('abc123', 'x').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(VersionRequestError)
    expect((error as VersionRequestError).status).toBe(422)
    expect((error as VersionRequestError).detail).toBe('no snapshot to label yet')
    expect((error as VersionRequestError).message).toBe('no snapshot to label yet')
  })
})

describe('restorePageVersion', () => {
  it('posts the version id to the restore endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...VERSION, label: null }, 201))

    await restorePageVersion('abc123', 7)

    expect(fetchMock.mock.calls[0][0]).toBe('/pages/abc123/versions/restore')
    expect(lastInit().method).toBe('POST')
    expect(lastInit().body).toBe(JSON.stringify({ version_id: 7 }))
  })
})

describe('failures', () => {
  it('stays compatible with the shared page error helpers', async () => {
    fetchMock.mockResolvedValue(htmlResponse(419))

    const error = await fetchPageVersions('abc123').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(PageRequestError)
    expect(isCsrfExpired(error)).toBe(true)
  })

  it('rejects when an ok response is not json', async () => {
    fetchMock.mockResolvedValue(htmlResponse(200))

    const error = await fetchPageVersions('abc123').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(VersionRequestError)
    expect((error as VersionRequestError).status).toBe(200)
    expect((error as VersionRequestError).detail).toBeNull()
  })

  it('reports a 403 without a parsable body', async () => {
    fetchMock.mockResolvedValue(htmlResponse(403))

    const error = await fetchPageVersion('abc123', 7).catch((cause: unknown) => cause)

    expect((error as VersionRequestError).status).toBe(403)
    expect(isCsrfExpired(error)).toBe(false)
  })
})
