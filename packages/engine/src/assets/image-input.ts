export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export type ImageInputRejection = 'mime' | 'size'

export interface ImageInputValidation {
  ok: boolean
  reason?: ImageInputRejection
}

export function validateImageInput(
  blob: { type: string; size: number },
  maxBytes: number = MAX_IMAGE_BYTES,
): ImageInputValidation {
  if (!blob.type.startsWith('image/')) return { ok: false, reason: 'mime' }
  if (blob.size > maxBytes) return { ok: false, reason: 'size' }
  return { ok: true }
}
