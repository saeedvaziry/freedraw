import { describe, expect, it } from 'vitest'
import type { PageVersion } from '@/lib/persistence'
import {
  AUTO_VERSION_LABEL,
  formatVersionTime,
  isNamedVersion,
  versionByline,
  versionTitle,
} from './version-format.js'

const NOW = Date.parse('2026-07-25T12:00:00.000Z')

function version(overrides: Partial<PageVersion> = {}): PageVersion {
  return {
    id: 1,
    label: 'Before the redesign',
    upToSeq: 10,
    createdAt: '2026-07-25T11:00:00.000Z',
    creator: { id: 2, name: 'Ada' },
    ...overrides,
  }
}

describe('versionTitle', () => {
  it('uses the label of a named version', () => {
    expect(versionTitle(version())).toBe('Before the redesign')
  })

  it('falls back to the auto label when there is none', () => {
    expect(versionTitle(version({ label: null }))).toBe(AUTO_VERSION_LABEL)
    expect(versionTitle(version({ label: '   ' }))).toBe(AUTO_VERSION_LABEL)
  })
})

describe('isNamedVersion', () => {
  it('separates named versions from automatic ones', () => {
    expect(isNamedVersion(version())).toBe(true)
    expect(isNamedVersion(version({ label: null }))).toBe(false)
    expect(isNamedVersion(version({ label: '  ' }))).toBe(false)
  })
})

describe('formatVersionTime', () => {
  it('handles missing and unparsable timestamps', () => {
    expect(formatVersionTime(null, NOW)).toBe('Unknown time')
    expect(formatVersionTime('not a date', NOW)).toBe('Unknown time')
  })

  it('reads fresh and future timestamps as just now', () => {
    expect(formatVersionTime('2026-07-25T11:59:30.000Z', NOW)).toBe('Just now')
    expect(formatVersionTime('2026-07-25T12:05:00.000Z', NOW)).toBe('Just now')
  })

  it('scales the unit with the age of the version', () => {
    expect(formatVersionTime('2026-07-25T11:45:00.000Z', NOW)).toBe('15 min ago')
    expect(formatVersionTime('2026-07-25T09:00:00.000Z', NOW)).toBe('3 h ago')
    expect(formatVersionTime('2026-07-23T12:00:00.000Z', NOW)).toBe('2 d ago')
  })

  it('falls back to a date past a week', () => {
    expect(formatVersionTime('2026-06-01T12:00:00.000Z', NOW)).not.toMatch(/ago/)
  })
})

describe('versionByline', () => {
  it('appends the creator when one is known', () => {
    expect(versionByline(version(), NOW)).toBe('1 h ago · Ada')
  })

  it('omits the separator for an unattributed version', () => {
    expect(versionByline(version({ creator: null }), NOW)).toBe('1 h ago')
  })
})
