import { Github, Heart } from 'lucide-react'
import { FloatingPanel, IconButton, cn } from '@/components/board/ui-kit'

const REPO_URL = 'https://github.com/saeedvaziry/freedraw'
const SPONSORS_URL = 'https://github.com/sponsors/saeedvaziry'

export function LinksBar() {
  return (
    <FloatingPanel className="pointer-events-auto">
      <LinkButton href={REPO_URL} label="View source on GitHub">
        <Github className="size-4" />
      </LinkButton>
      <LinkButton href={SPONSORS_URL} label="Sponsor on GitHub" className="hover:text-rose-600">
        <Heart className="size-4" />
      </LinkButton>
    </FloatingPanel>
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
    <IconButton
      asChild
      aria-label={label}
      className={cn('size-7 rounded-md text-foreground/70 coarse:size-7', className)}
    >
      <a href={href} target="_blank" rel="noreferrer" title={label}>
        {children}
      </a>
    </IconButton>
  )
}
