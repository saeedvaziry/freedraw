interface IconProps {
  className?: string
}

export function DashedLineIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="12" x2="7" y2="12" />
      <line x1="11" y1="12" x2="15" y2="12" />
      <line x1="19" y1="12" x2="21" y2="12" />
    </svg>
  )
}

export function DottedLineIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="4" y1="12" x2="4.5" y2="12" />
      <line x1="9" y1="12" x2="9.5" y2="12" />
      <line x1="14" y1="12" x2="14.5" y2="12" />
      <line x1="19" y1="12" x2="19.5" y2="12" />
    </svg>
  )
}

export function ArrowheadNoneIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  )
}

export function ArrowheadTriangleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="18" y2="12" />
      <path d="M14 8l5 4-5 4" fill="currentColor" />
    </svg>
  )
}

export function ArrowheadDotIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="12" x2="16" y2="12" />
      <circle cx="18" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ArrowheadBarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="12" x2="19" y2="12" />
      <line x1="19" y1="7" x2="19" y2="17" />
    </svg>
  )
}
