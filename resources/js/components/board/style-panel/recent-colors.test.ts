import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_RECENT_COLORS,
  RECENT_COLORS_KEY,
  readRecentColors,
  rememberColor,
  writeRecentColors,
} from './recent-colors.js'

describe('rememberColor', () => {
  it('puts the newest colour first and normalises it', () => {
    expect(rememberColor([], '#ABC')).toEqual(['#aabbcc'])
    expect(rememberColor(['#111111'], '#222222')).toEqual(['#222222', '#111111'])
  })

  it('moves an existing colour to the front instead of duplicating it', () => {
    expect(rememberColor(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111'])
  })

  it('caps the list', () => {
    let colors: string[] = []
    for (let i = 0; i < MAX_RECENT_COLORS + 4; i += 1) {
      colors = rememberColor(colors, `#0000${i.toString(16).padStart(2, '0')}`)
    }

    expect(colors).toHaveLength(MAX_RECENT_COLORS)
  })

  it('ignores transparency and junk', () => {
    expect(rememberColor(['#111111'], 'transparent')).toEqual(['#111111'])
    expect(rememberColor(['#111111'], 'nope')).toEqual(['#111111'])
  })
})

describe('recent colour storage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(RECENT_COLORS_KEY)
  })

  it('round-trips through local storage', () => {
    writeRecentColors(['#aabbcc', '#112233'])

    expect(readRecentColors()).toEqual(['#aabbcc', '#112233'])
  })

  it('returns an empty list for missing or malformed storage', () => {
    expect(readRecentColors()).toEqual([])

    window.localStorage.setItem(RECENT_COLORS_KEY, 'not json')
    expect(readRecentColors()).toEqual([])

    window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify({ nope: true }))
    expect(readRecentColors()).toEqual([])
  })

  it('drops non-hex entries and duplicates when reading', () => {
    window.localStorage.setItem(
      RECENT_COLORS_KEY,
      JSON.stringify(['#aabbcc', 'transparent', '#AABBCC', 7, '#123']),
    )

    expect(readRecentColors()).toEqual(['#aabbcc', '#112233'])
  })
})
