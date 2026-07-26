import { SquareStack } from 'lucide-react'
import { cn, FloatingPanel, IconButton } from '@/components/board/ui-kit'

export interface SlidesButtonProps {
  active: boolean
  onToggle(): void
}

export function SlidesButton({ active, onToggle }: SlidesButtonProps) {
  return (
    <FloatingPanel className="pointer-events-auto">
      <IconButton
        aria-label="Slides"
        title="Slides"
        active={active}
        onClick={onToggle}
        className={cn('size-7 rounded-md coarse:size-7', !active && 'text-foreground/70')}
      >
        <SquareStack className="size-4" />
      </IconButton>
    </FloatingPanel>
  )
}
