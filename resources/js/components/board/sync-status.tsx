import { useSyncExternalStore } from 'react'
import { Check, CloudOff, RefreshCw } from 'lucide-react'
import type { SyncStatus as SyncStatusValue } from '@/lib/persistence'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/board/ui-kit'
import { useBoardContext } from './board-context.js'

const LABELS: Record<SyncStatusValue, string> = {
  saved: 'All changes saved',
  saving: 'Saving…',
  offline: 'Offline — changes saved locally',
}

export function SyncStatus() {
  const { sync } = useBoardContext()

  const status = useSyncExternalStore(
    (cb) => sync?.subscribe(cb) ?? (() => {}),
    () => sync?.getStatus() ?? 'saved',
  )

  if (!sync) return null

  const label = LABELS[status]

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={label}
            className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-lg border bg-background/90 px-2.5 text-sm text-muted-foreground shadow-sm backdrop-blur [&_svg]:size-4"
          >
            {status === 'saving' ? (
              <RefreshCw className="animate-spin text-muted-foreground" />
            ) : status === 'offline' ? (
              <CloudOff className="text-destructive" />
            ) : (
              <Check className="text-emerald-500 dark:text-emerald-400" />
            )}
            <span className={cn('hidden md:inline', status === 'offline' && 'text-destructive')}>
              {status === 'saving' ? 'Saving' : status === 'offline' ? 'Offline' : 'Saved'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
