import * as Y from 'yjs'
import type { BoardPage, PagePermission, PageVisibility } from '@/types'

export interface SavePagePayload {
  title?: string | null
  document?: string | null
}

export interface SharePagePayload {
  visibility: PageVisibility
  permission: PagePermission
}

export interface DeletePageResult {
  redirectUrl: string
}

const BASE64_CHUNK_SIZE = 0x8000

/** Thrown when a request fails; `status` lets callers special-case 419 (CSRF). */
export class PageRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Page request failed with ${status}`)
    this.name = 'PageRequestError'
  }
}

/** True when the session's CSRF token has expired and the page must reload. */
export function isCsrfExpired(error: unknown): boolean {
  return error instanceof PageRequestError && error.status === 419
}

/**
 * Read Laravel's XSRF-TOKEN cookie. Unlike the Blade meta tag this rotates with
 * the session, so long-lived board tabs keep sending a valid token instead of a
 * stale one. The cookie value is URL-encoded by Laravel.
 */
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      // Fall through to the meta tag below.
    }
  }

  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken(),
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new PageRequestError(response.status)
  }

  return (await response.json()) as T
}

export async function createRemotePage(payload: SavePagePayload = {}): Promise<BoardPage> {
  return requestJson<BoardPage>('/pages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateRemotePage(
  publicId: string,
  payload: SavePagePayload,
): Promise<BoardPage> {
  return requestJson<BoardPage>(`/pages/${encodeURIComponent(publicId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteRemotePage(publicId: string): Promise<DeletePageResult> {
  return requestJson<DeletePageResult>(`/pages/${encodeURIComponent(publicId)}`, {
    method: 'DELETE',
  })
}

export async function updateRemoteShare(
  publicId: string,
  payload: SharePagePayload,
): Promise<BoardPage> {
  return requestJson<BoardPage>(`/pages/${encodeURIComponent(publicId)}/share`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function encodeDocAsBase64(doc: Y.Doc): string {
  const update = Y.encodeStateAsUpdate(doc)
  let binary = ''

  for (let offset = 0; offset < update.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...update.subarray(offset, offset + BASE64_CHUNK_SIZE))
  }

  return btoa(binary)
}

export function applyBase64Update(doc: Y.Doc, value: string): void {
  const binary = atob(value)
  const update = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    update[index] = binary.charCodeAt(index)
  }

  Y.applyUpdate(doc, update)
}

export function documentHasContent(doc: Y.Doc): boolean {
  return doc.getArray('elementOrder').length > 0 || doc.getMap('elements').size > 0
}
