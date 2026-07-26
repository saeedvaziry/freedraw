import { fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PresencePeer } from '@/hooks/board/use-presence-roster.js'
import { PresenceStack } from './presence-stack.js'

function peer(clientId: number, overrides: Partial<PresencePeer> = {}): PresencePeer {
  return {
    clientId,
    id: `user:${clientId}`,
    kind: 'user',
    name: `Peer ${clientId}`,
    color: '#0090ff',
    avatar: null,
    isLocal: false,
    selectedCount: 0,
    ...overrides,
  }
}

function crowd(count: number): PresencePeer[] {
  return Array.from({ length: count }, (_, index) => peer(index + 1))
}

interface Options {
  peers?: readonly PresencePeer[]
  followingId?: number | null
  className?: string
}

function renderStack({ peers = crowd(2), followingId = null, className }: Options = {}) {
  const onFollow = vi.fn()
  const onStopFollowing = vi.fn()

  const view = render(
    createElement(TooltipProvider, {
      children: createElement(PresenceStack, {
        peers,
        followingId,
        onFollow,
        onStopFollowing,
        className,
      }) as ReactNode,
    }),
  )

  return { ...view, onFollow, onStopFollowing }
}

function trigger(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>('[data-test="presence-stack-trigger"]')
  if (!found) throw new Error('Missing presence stack trigger')
  return found
}

function row(clientId: number): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(`[data-test="presence-peer-${clientId}"]`)
  if (!found) throw new Error(`Missing presence row ${clientId}`)
  return found
}

function rows(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('[data-test^="presence-peer-"]')]
}

function avatars(scope: HTMLElement): Element[] {
  return [...scope.querySelectorAll('[data-slot="avatar"]')]
}

async function openStack(options: Options = {}) {
  const handles = renderStack(options)
  fireEvent.click(trigger())
  await screen.findByRole('dialog')
  return handles
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PresenceStack rendering', () => {
  it('renders nothing at all on an empty board', () => {
    const { container } = renderStack({ peers: [] })

    expect(container.innerHTML).toBe('')
    expect(document.querySelector('[data-test="presence-stack-trigger"]')).toBeNull()
  })

  it('counts a single person in the singular', () => {
    renderStack({ peers: crowd(1) })

    expect(trigger().getAttribute('aria-label')).toBe('1 person here')
    expect(screen.getByText('1 here')).not.toBeNull()
  })

  it('counts a crowd in the plural', () => {
    renderStack({ peers: crowd(4) })

    expect(trigger().getAttribute('aria-label')).toBe('4 people here')
    expect(screen.getByText('4 here')).not.toBeNull()
  })

  it('shows every avatar while the roster still fits', () => {
    renderStack({ peers: crowd(3) })

    expect(avatars(trigger())).toHaveLength(3)
    expect(trigger().textContent).not.toContain('+')
  })

  it('caps the avatars at three and counts the rest into the overflow badge', () => {
    renderStack({ peers: crowd(6) })

    expect(avatars(trigger())).toHaveLength(3)
    expect(screen.getByText('+3')).not.toBeNull()
  })

  it('paints each avatar with the peer colour and initials', () => {
    renderStack({ peers: [peer(1, { name: 'Ada Lovelace', color: '#ff0000' })] })

    const avatar = avatars(trigger())[0] as HTMLElement

    expect(avatar.getAttribute('title')).toBe('Ada Lovelace')
    expect(avatar.style.backgroundColor).toBe('#ff0000')
    expect(avatar.style.boxShadow).toContain('#ff0000')
    expect(avatar.textContent).toBe('AL')
  })

  it('merges the caller class onto the floating panel', () => {
    renderStack({ className: 'top-3' })

    const panel = document.querySelector('[data-slot="floating-panel"]')

    expect(panel?.className).toContain('top-3')
    expect(panel?.className).toContain('pointer-events-auto')
  })

  it('keeps the roster out of the document until the stack is opened', () => {
    renderStack({ peers: crowd(3) })

    expect(rows()).toHaveLength(0)
    expect(trigger().getAttribute('data-state')).toBe('closed')
  })
})

describe('PresenceStack roster', () => {
  it('lists every peer once the stack is opened', async () => {
    await openStack({ peers: crowd(5) })

    expect(rows().map((entry) => entry.getAttribute('data-test'))).toEqual([
      'presence-peer-1',
      'presence-peer-2',
      'presence-peer-3',
      'presence-peer-4',
      'presence-peer-5',
    ])
    expect(screen.getAllByText('5 people here')).not.toHaveLength(0)
  })

  it('marks the local peer as you and keeps it unfollowable', async () => {
    await openStack({ peers: [peer(1, { isLocal: true, name: 'Ada' }), peer(2)] })

    expect(screen.getByText('You')).not.toBeNull()
    expect(screen.getByText('Ada')).not.toBeNull()
    expect(rows().map((entry) => entry.getAttribute('data-test'))).toEqual(['presence-peer-2'])
  })

  it('shows how many elements a peer has selected', async () => {
    await openStack({ peers: [peer(1, { selectedCount: 3 }), peer(2)] })

    expect(screen.getByText('3 selected')).not.toBeNull()
    expect(screen.queryByText('0 selected')).toBeNull()
  })

  it('offers to follow a peer that is not being followed', async () => {
    await openStack({ peers: crowd(2) })

    expect(row(2).getAttribute('aria-pressed')).toBe('false')
    expect(row(2).textContent).toContain('Follow')
    expect(row(2).textContent).not.toContain('Stop following')
  })

  it('offers to stop following the peer that is being followed', async () => {
    await openStack({ peers: crowd(2), followingId: 2 })

    expect(row(2).getAttribute('aria-pressed')).toBe('true')
    expect(row(1).getAttribute('aria-pressed')).toBe('false')
    expect(row(2).textContent).toContain('Stop following')
    expect(row(2).className).toContain('bg-accent')
  })
})

describe('PresenceStack following', () => {
  it('follows the peer that was picked', async () => {
    const { onFollow, onStopFollowing } = await openStack({ peers: crowd(3) })

    fireEvent.click(row(3))

    expect(onFollow).toHaveBeenCalledWith(3)
    expect(onStopFollowing).not.toHaveBeenCalled()
  })

  it('stops following the peer that is already followed', async () => {
    const { onFollow, onStopFollowing } = await openStack({ peers: crowd(3), followingId: 3 })

    fireEvent.click(row(3))

    expect(onStopFollowing).toHaveBeenCalledTimes(1)
    expect(onFollow).not.toHaveBeenCalled()
  })

  it('switches straight to another peer while one is followed', async () => {
    const { onFollow, onStopFollowing } = await openStack({ peers: crowd(3), followingId: 3 })

    fireEvent.click(row(2))

    expect(onFollow).toHaveBeenCalledWith(2)
    expect(onStopFollowing).not.toHaveBeenCalled()
  })
})
