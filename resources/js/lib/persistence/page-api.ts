import * as Y from 'yjs'
import type { BoardPage } from '@/types'

export interface SavePagePayload {
  title?: string | null
  document?: string | null
}

export interface DeletePageResult {
  redirectUrl: string
}

const BASE64_CHUNK_SIZE = 0x8000

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrfToken(),
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Page request failed with ${response.status}`)
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
