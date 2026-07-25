import { PageRequestError } from './page-api.js'

export interface PageVersionCreator {
  id: number
  name: string
}

export interface PageVersion {
  id: number
  label: string | null
  upToSeq: number
  createdAt: string | null
  creator: PageVersionCreator | null
}

export interface PageVersionState extends PageVersion {
  state: string
}

export class VersionRequestError extends PageRequestError {
  constructor(
    status: number,
    public readonly detail: string | null = null,
  ) {
    super(status)
    this.name = 'VersionRequestError'
    if (detail) this.message = detail
  }
}

function metaToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)

  if (!match) return metaToken()

  try {
    return decodeURIComponent(match[1])
  } catch {
    return metaToken()
  }
}

function readMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const message = (body as { message?: unknown }).message
  return typeof message === 'string' && message.length > 0 ? message : null
}

async function toError(response: Response): Promise<VersionRequestError> {
  try {
    return new VersionRequestError(response.status, readMessage(await response.json()))
  } catch {
    return new VersionRequestError(response.status)
  }
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': csrfToken(),
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw await toError(response)
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new VersionRequestError(response.status)
  }
}

function versionsUrl(publicId: string): string {
  return `/pages/${encodeURIComponent(publicId)}/versions`
}

export function fetchPageVersions(publicId: string): Promise<PageVersion[]> {
  return requestJson<PageVersion[]>(versionsUrl(publicId), { method: 'GET' })
}

export function fetchPageVersion(publicId: string, versionId: number): Promise<PageVersionState> {
  return requestJson<PageVersionState>(
    `${versionsUrl(publicId)}/${encodeURIComponent(String(versionId))}`,
    { method: 'GET' },
  )
}

export function createPageVersion(publicId: string, label: string): Promise<PageVersion> {
  return requestJson<PageVersion>(versionsUrl(publicId), {
    method: 'POST',
    body: JSON.stringify({ label }),
  })
}

export function restorePageVersion(publicId: string, versionId: number): Promise<PageVersion> {
  return requestJson<PageVersion>(`${versionsUrl(publicId)}/restore`, {
    method: 'POST',
    body: JSON.stringify({ version_id: versionId }),
  })
}
