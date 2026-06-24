import type { LucideIcon } from 'lucide-react'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { Appearance } from '@/hooks/use-appearance'
import { useAppearance } from '@/hooks/use-appearance'
import { cn } from '@/lib/utils'

const tabs: { value: Appearance; icon: LucideIcon; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

/**
 * Icon-only, full-width light / dark / system segmented control sized to sit
 * inside a dropdown menu. Three equal segments, the active one highlighted.
 */
export function AppearanceSegmented({ className }: { className?: string }) {
  const { appearance, updateAppearance } = useAppearance()

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('flex gap-1 rounded-lg bg-muted p-1', className)}
    >
      {tabs.map(({ value, icon: Icon, label }) => {
        const active = appearance === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => updateAppearance(value)}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors [&_svg]:size-4',
              active
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon />
          </button>
        )
      })}
    </div>
  )
}
