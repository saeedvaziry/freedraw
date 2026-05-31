import * as React from 'react'
import type { LucideProps } from 'lucide-react'

export const ParallelogramIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, className, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M8 5h13l-5 14H3z" />
    </svg>
  ),
)
ParallelogramIcon.displayName = 'ParallelogramIcon'
