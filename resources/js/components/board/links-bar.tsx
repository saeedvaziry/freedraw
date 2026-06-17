import { Github, Heart } from 'lucide-react'
import { cn } from '@/components/board/ui-kit'

const REPO_URL = 'https://github.com/saeedvaziry/freedraw'
const SPONSORS_URL = 'https://github.com/sponsors/saeedvaziry'

export function LinksBar() {
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border bg-background/90 px-1 py-0.5 shadow-sm backdrop-blur">
      <LinkButton href={REPO_URL} label="View source on GitHub">
        <Github className="size-4" />
      </LinkButton>
      <LinkButton href={SPONSORS_URL} label="Sponsor on GitHub" className="hover:text-rose-600">
        <Heart className="size-4" />
      </LinkButton>
    </div>
  )
}

interface LinkButtonProps {
  href: string
  label: string
  className?: string
  children: React.ReactNode
}

function LinkButton({ href, label, className, children }: LinkButtonProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-7 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {children}
    </a>
  )
}
