import { cn } from '@/lib/utils'

interface IconProps {
  className?: string
}

const line = 'absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-current'

export function DashedLineIcon({ className }: IconProps) {
  return (
    <span className={cn('relative block size-6', className)} aria-hidden="true">
      <span className={cn(line, 'left-0 w-1.5')} />
      <span className={cn(line, 'left-2.5 w-1.5')} />
      <span className={cn(line, 'right-0 w-1.5')} />
    </span>
  )
}

export function DottedLineIcon({ className }: IconProps) {
  return (
    <span className={cn('relative block size-6', className)} aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className="absolute top-1/2 size-1 -translate-y-1/2 rounded-full bg-current"
          style={{ left: `${index * 6 + 1}px` }}
        />
      ))}
    </span>
  )
}

export function ArrowheadNoneIcon({ className }: IconProps) {
  return (
    <span className={cn('relative block size-6', className)} aria-hidden="true">
      <span className={cn(line, 'left-1 right-1')} />
    </span>
  )
}

export function ArrowheadTriangleIcon({ className }: IconProps) {
  return (
    <span className={cn('relative block size-6', className)} aria-hidden="true">
      <span className={cn(line, 'left-1 right-2')} />
      <span className="absolute right-1 top-1/2 size-0 -translate-y-1/2 border-y-[5px] border-l-[7px] border-y-transparent border-l-current" />
    </span>
  )
}

export function ArrowheadDotIcon({ className }: IconProps) {
  return (
    <span className={cn('relative block size-6', className)} aria-hidden="true">
      <span className={cn(line, 'left-1 right-2.5')} />
      <span className="absolute right-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-current" />
    </span>
  )
}

export function ArrowheadBarIcon({ className }: IconProps) {
  return (
    <span className={cn('relative block size-6', className)} aria-hidden="true">
      <span className={cn(line, 'left-1 right-1')} />
      <span className="absolute right-1 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-current" />
    </span>
  )
}
