import { Highlighter } from 'lucide-react'
import { FloatingPanel, IconButton } from '@/components/board/ui-kit'
import type { LaserPointer } from '@/hooks/board/use-laser.js'

export type LaserToggleState = Pick<LaserPointer, 'active' | 'available' | 'toggle'>

export interface LaserToggleProps {
  laser: LaserToggleState
  className?: string
}

export const LASER_LABEL_ON = 'Turn off laser pointer'
export const LASER_LABEL_OFF = 'Turn on laser pointer'

export function LaserToggle({ laser, className }: LaserToggleProps) {
  if (!laser.available) return null

  const label = laser.active ? LASER_LABEL_ON : LASER_LABEL_OFF

  return (
    <FloatingPanel className="pointer-events-auto">
      <IconButton
        aria-label={label}
        title={label}
        active={laser.active}
        onClick={laser.toggle}
        className={className ?? 'size-7 rounded-md text-foreground/70 coarse:size-7'}
      >
        <Highlighter className="size-4" />
      </IconButton>
    </FloatingPanel>
  )
}
