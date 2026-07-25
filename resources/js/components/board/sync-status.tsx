import { Check, CloudOff, Eye, LoaderCircle, RefreshCw, type LucideIcon } from 'lucide-react'
import {
  useConnectionStatus,
  type ConnectionStatus as ConnectionStatusValue,
  type ConnectionTone,
} from '@/hooks/board/use-connection-status.js'
import { cn } from '@/lib/utils'
import {
  FloatingPanel,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/board/ui-kit'

const ICONS: Record<ConnectionStatusValue, LucideIcon> = {
  saved: Check,
  saving: RefreshCw,
  reconnecting: LoaderCircle,
  offline: CloudOff,
  'view-only': Eye,
}

const ICON_TONES: Record<ConnectionTone, string> = {
  positive: 'text-emerald-500 dark:text-emerald-400',
  pending: 'text-muted-foreground',
  attention: 'text-amber-600 dark:text-amber-400',
  calm: 'text-muted-foreground',
  accent: 'text-amber-700 dark:text-amber-300',
}

const LABEL_TONES: Record<ConnectionTone, string> = {
  positive: 'text-muted-foreground',
  pending: 'text-muted-foreground',
  attention: 'text-amber-700 dark:text-amber-300',
  calm: 'text-muted-foreground',
  accent: 'text-amber-800 dark:text-amber-200',
}

export function SyncStatus() {
  const { status, label, description, tone, visible } = useConnectionStatus()

  if (!visible) return null

  const Icon = ICONS[status]
  const viewOnly = status === 'view-only'
  const spinning = status === 'saving' || status === 'reconnecting'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <FloatingPanel
          padding={false}
          role="status"
          aria-live="polite"
          aria-label={description}
          className={cn(
            'pointer-events-auto h-9 gap-1.5 px-2.5 text-sm text-muted-foreground [&_svg]:size-4',
            viewOnly &&
              'border-amber-500/40 bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-400/10',
          )}
        >
          <Icon className={cn(ICON_TONES[tone], spinning && 'animate-spin')} />
          <span
            className={cn(
              LABEL_TONES[tone],
              viewOnly ? 'inline font-medium' : 'hidden md:inline',
            )}
          >
            {label}
          </span>
        </FloatingPanel>
      </TooltipTrigger>
      <TooltipContent side="bottom">{description}</TooltipContent>
    </Tooltip>
  )
}
