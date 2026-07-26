import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  FloatingPanel,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@/components/board/ui-kit'
import { useInitials } from '@/hooks/use-initials'
import type { PresencePeer } from '@/hooks/board/use-presence-roster.js'

const MAX_AVATARS = 3

export interface PresenceStackProps {
  peers: readonly PresencePeer[]
  followingId: number | null
  onFollow(clientId: number): void
  onStopFollowing(): void
  className?: string
}

export function PresenceStack({
  peers,
  followingId,
  onFollow,
  onStopFollowing,
  className,
}: PresenceStackProps) {
  const [open, setOpen] = useState(false)

  if (peers.length === 0) return null

  const shown = peers.slice(0, MAX_AVATARS)
  const overflow = peers.length - shown.length
  const summary = `${peers.length} ${peers.length === 1 ? 'person' : 'people'} here`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FloatingPanel
        padding={false}
        gap={false}
        className={cn('pointer-events-auto h-9 px-1.5 coarse:h-11', className)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={summary}
                data-test="presence-stack-trigger"
                className="flex h-8 items-center gap-2 rounded-md px-1 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:outline-none coarse:h-10"
              >
                <span className="flex -space-x-2">
                  {shown.map((peer) => (
                    <PresenceAvatar
                      key={peer.clientId}
                      peer={peer}
                      following={followingId === peer.clientId}
                    />
                  ))}
                  {overflow > 0 ? (
                    <span className="flex size-7 items-center justify-center rounded-full border-2 border-[color:var(--panel-bg)] bg-muted text-[0.625rem] font-semibold text-muted-foreground">
                      +{overflow}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {peers.length} here
                </span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{summary}</TooltipContent>
        </Tooltip>
      </FloatingPanel>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-64 max-w-[calc(100vw-1.5rem)] p-1"
      >
        <p className="px-2 py-1 text-xs font-normal text-muted-foreground">{summary}</p>
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {peers.map((peer) => (
            <PeerRow
              key={peer.clientId}
              peer={peer}
              following={followingId === peer.clientId}
              onFollow={onFollow}
              onStopFollowing={onStopFollowing}
            />
          ))}
        </div>
        <p className="border-t border-border px-2 pt-2 pb-1 text-[0.6875rem] leading-relaxed text-foreground/55">
          Following moves your view only. Pan or zoom to stop
          <span className="hidden sm:inline">, or press Esc</span>.
        </p>
      </PopoverContent>
    </Popover>
  )
}

interface PeerRowProps {
  peer: PresencePeer
  following: boolean
  onFollow(clientId: number): void
  onStopFollowing(): void
}

function PeerRow({ peer, following, onFollow, onStopFollowing }: PeerRowProps) {
  if (peer.isLocal) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm coarse:py-2.5">
        <PresenceAvatar peer={peer} following={false} />
        <span className="min-w-0 flex-1 truncate">{peer.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">You</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      data-test={`presence-peer-${peer.clientId}`}
      aria-pressed={following}
      onClick={() => (following ? onStopFollowing() : onFollow(peer.clientId))}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent coarse:py-2.5',
        following && 'bg-accent',
      )}
    >
      <PresenceAvatar peer={peer} following={following} />
      <span className="min-w-0 flex-1 truncate">{peer.name}</span>
      {peer.selectedCount > 0 ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {peer.selectedCount} selected
        </span>
      ) : null}
      {following ? (
        <EyeOff className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <Eye className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="sr-only">{following ? 'Stop following' : 'Follow'}</span>
    </button>
  )
}

interface PresenceAvatarProps {
  peer: PresencePeer
  following: boolean
}

function PresenceAvatar({ peer, following }: PresenceAvatarProps) {
  const getInitials = useInitials()

  return (
    <Avatar
      title={peer.name}
      className="size-7 shrink-0 border-2 border-[color:var(--panel-bg)]"
      style={{
        backgroundColor: peer.color,
        boxShadow: `0 0 0 ${following ? '2px' : '1px'} ${peer.color}`,
      }}
    >
      {peer.avatar ? <AvatarImage src={peer.avatar} alt="" /> : null}
      <AvatarFallback
        className="text-[0.625rem] font-semibold text-white"
        style={{ backgroundColor: peer.color }}
      >
        {getInitials(peer.name)}
      </AvatarFallback>
    </Avatar>
  )
}
