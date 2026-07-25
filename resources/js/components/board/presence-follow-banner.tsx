import { Eye, X } from 'lucide-react'
import { Button, FloatingPanel } from '@/components/board/ui-kit'
import type { PresencePeer } from '@/hooks/board/use-presence-roster.js'

export interface PresenceFollowBannerProps {
  peer: PresencePeer
  onStop(): void
}

export function PresenceFollowBanner({ peer, onStop }: PresenceFollowBannerProps) {
  return (
    <FloatingPanel
      role="status"
      aria-live="polite"
      data-test="presence-follow-banner"
      className="pointer-events-auto max-w-full flex-wrap gap-2 px-3 py-2 sm:flex-nowrap"
      style={{ borderColor: peer.color }}
    >
      <Eye className="size-4 shrink-0" style={{ color: peer.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">Following {peer.name}</p>
        <p className="truncate text-xs text-foreground/60">
          Your view only · pan, zoom or press Esc to stop
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5 coarse:h-10"
        onClick={onStop}
      >
        <X className="size-4" />
        Stop
      </Button>
    </FloatingPanel>
  )
}
