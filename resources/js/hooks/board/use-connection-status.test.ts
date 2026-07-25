import { act, renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { BoardProvider, type BoardContextValue } from '@/components/board/board-context.js'
import type { PageSync, SyncStatus } from '@/lib/persistence'
import { CONNECTION_STATUS_DESCRIPTORS, useConnectionStatus } from './use-connection-status.js'

interface FakeSync {
  sync: PageSync
  emit(status: SyncStatus): void
  listeners(): number
}

function fakeSync(initial: SyncStatus): FakeSync {
  let status = initial
  const listeners = new Set<() => void>()

  return {
    sync: {
      getStatus: () => status,
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      flush: () => Promise.resolve(),
      destroy: () => undefined,
    },
    emit(next) {
      status = next
      listeners.forEach((listener) => listener())
    },
    listeners: () => listeners.size,
  }
}

function setup(sync: PageSync | null, readOnly = false) {
  const value = {
    store: {},
    controller: null,
    boardExport: {},
    theme: 'light',
    readOnly,
    scope: readOnly ? 'view' : 'edit',
    openImagePicker: () => undefined,
    sync,
  } as unknown as BoardContextValue

  return renderHook(() => useConnectionStatus(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(BoardProvider, { value, children }),
  })
}

describe('useConnectionStatus without a sync', () => {
  it('reads as saved but stays hidden on a board that never syncs', () => {
    const { result } = setup(null)

    expect(result.current.status).toBe('saved')
    expect(result.current.visible).toBe(false)
    expect(result.current.label).toBe('Saved')
    expect(result.current.tone).toBe('positive')
  })

  it('shows the view-only badge even without a sync', () => {
    const { result } = setup(null, true)

    expect(result.current.status).toBe('view-only')
    expect(result.current.visible).toBe(true)
    expect(result.current.tone).toBe('accent')
  })
})

describe('useConnectionStatus with a sync', () => {
  it('mirrors the current sync status and its copy', () => {
    const { result } = setup(fakeSync('saving').sync)

    expect(result.current.status).toBe('saving')
    expect(result.current.visible).toBe(true)
    expect(result.current).toMatchObject(CONNECTION_STATUS_DESCRIPTORS.saving)
  })

  it('re-renders when the sync reports a new status', () => {
    const sync = fakeSync('saved')
    const { result } = setup(sync.sync)

    act(() => {
      sync.emit('offline')
    })

    expect(result.current.status).toBe('offline')
    expect(result.current.tone).toBe('calm')

    act(() => {
      sync.emit('no-access')
    })

    expect(result.current.status).toBe('no-access')
    expect(result.current.label).toBe('No access')
  })

  it('lets read-only win over whatever the sync reports', () => {
    const sync = fakeSync('reconnecting')
    const { result } = setup(sync.sync, true)

    expect(result.current.status).toBe('view-only')

    act(() => {
      sync.emit('offline')
    })

    expect(result.current.status).toBe('view-only')
  })

  it('unsubscribes from the sync on unmount', () => {
    const sync = fakeSync('saved')
    const { unmount } = setup(sync.sync)

    expect(sync.listeners()).toBe(1)

    unmount()

    expect(sync.listeners()).toBe(0)
  })
})

describe('CONNECTION_STATUS_DESCRIPTORS', () => {
  it('describes every status the badge can show', () => {
    expect(Object.keys(CONNECTION_STATUS_DESCRIPTORS)).toEqual([
      'saved',
      'saving',
      'reconnecting',
      'offline',
      'no-access',
      'view-only',
    ])
    for (const descriptor of Object.values(CONNECTION_STATUS_DESCRIPTORS)) {
      expect(descriptor.label.length).toBeGreaterThan(0)
      expect(descriptor.description.length).toBeGreaterThan(0)
    }
  })
})
