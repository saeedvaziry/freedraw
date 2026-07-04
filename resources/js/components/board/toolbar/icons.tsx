import { cn } from '@/lib/utils'

interface IconProps {
  className?: string
}

export function ParallelogramIcon({ className }: IconProps) {
  return (
    <span
      className={cn(
        'block size-4 -skew-x-12 rounded-[2px] border-2 border-current',
        className,
      )}
      aria-hidden="true"
    />
  )
}
