import type { PageVersion } from '@/lib/persistence'

export const AUTO_VERSION_LABEL = 'Auto save'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function isNamedVersion(version: Pick<PageVersion, 'label'>): boolean {
  return (version.label?.trim().length ?? 0) > 0
}

export function versionTitle(version: Pick<PageVersion, 'label'>): string {
  const label = version.label?.trim()
  return label && label.length > 0 ? label : AUTO_VERSION_LABEL
}

export function formatVersionTime(createdAt: string | null, now: number = Date.now()): string {
  if (!createdAt) return 'Unknown time'

  const at = Date.parse(createdAt)

  if (Number.isNaN(at)) return 'Unknown time'

  const delta = now - at

  if (delta < MINUTE) return 'Just now'

  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} min ago`

  if (delta < DAY) return `${Math.floor(delta / HOUR)} h ago`

  if (delta < WEEK) return `${Math.floor(delta / DAY)} d ago`

  return new Date(at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function versionByline(version: PageVersion, now: number = Date.now()): string {
  const when = formatVersionTime(version.createdAt, now)
  return version.creator ? `${when} · ${version.creator.name}` : when
}
