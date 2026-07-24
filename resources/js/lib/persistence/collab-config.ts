const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

export interface CollabConfig {
  enabled: boolean
  url: string
}

export function readCollabConfig(): CollabConfig {
  const flag = String(import.meta.env.VITE_COLLAB_ENABLED ?? '')
    .trim()
    .toLowerCase()
  const url = String(import.meta.env.VITE_COLLAB_URL ?? '').trim()

  return {
    enabled: TRUTHY.has(flag) && url !== '',
    url,
  }
}
