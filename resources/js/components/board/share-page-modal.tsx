import { Check, Copy, Globe, Lock, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/components/board/ui-kit'
import { useShare } from '@/hooks/board/use-share'
import type { BoardPage, PageVisibility } from '@/types'

type Props = {
  boardPage: BoardPage
  open: boolean
  onOpenChange(open: boolean): void
}

const VISIBILITY_OPTIONS: {
  value: PageVisibility
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}[] = [
  {
    value: 'private',
    label: 'Only me',
    description: 'Only you and organization admins can open this page.',
    icon: Lock,
  },
  {
    value: 'organization',
    label: 'Anyone in your organization',
    description: 'Members of this organization can open the page.',
    icon: Users,
  },
  {
    value: 'public',
    label: 'Anyone with the link',
    description: 'Anyone on the internet with the link can view (read-only).',
    icon: Globe,
  },
]

/**
 * Share settings for a single page. Visibility is chosen from a list and applied
 * immediately; an organization share can additionally grant edit access, while a
 * public share is always read-only and reveals a copyable short link.
 */
export function SharePageModal({ boardPage, open, onOpenChange }: Props) {
  const { visibility, permission, shareUrl, busy, copied, setVisibility, setPermission, copyLink } =
    useShare(boardPage)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{boardPage.title}”</DialogTitle>
          <DialogDescription>
            Choose who can access this page. Only you and organization admins can change these
            settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {VISIBILITY_OPTIONS.map((option) => {
            const Icon = option.icon
            const selected = visibility === option.value
            return (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => setVisibility(option.value)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none disabled:opacity-60',
                  selected ? 'border-primary bg-accent' : 'hover:bg-accent',
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-foreground/70" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.description}</span>
                </span>
                {selected ? <Check className="mt-0.5 size-4 shrink-0 text-primary" /> : null}
              </button>
            )
          })}
        </div>

        {visibility === 'organization' ? (
          <div className="grid gap-2">
            <Label htmlFor="share-permission">Permission</Label>
            <Select
              value={permission}
              disabled={busy}
              onValueChange={(value) => setPermission(value as 'view' | 'edit')}
            >
              <SelectTrigger id="share-permission" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">Can view</SelectItem>
                <SelectItem value="edit">Can edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {visibility === 'public' && shareUrl ? (
          <div className="grid gap-2">
            <Label htmlFor="share-link">Public link</Label>
            <div className="flex items-center gap-2">
              <Input id="share-link" readOnly value={shareUrl} className="flex-1" />
              <Button type="button" variant="secondary" onClick={copyLink} className="shrink-0 gap-1.5">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
