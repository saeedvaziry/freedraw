import { Link, router, usePage } from '@inertiajs/react'
import {
  Check,
  ChevronsUpDown,
  House,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useLayoutEffect, useState } from 'react'
import AppLogoIcon from '@/components/app-logo-icon'
import CreateOrganizationModal from '@/components/create-organization-modal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, Tooltip, TooltipContent, TooltipTrigger } from '@/components/board/ui-kit'
import { UserInfo } from '@/components/user-info'
import { useInitials } from '@/hooks/use-initials'
import { useMobileNavigation } from '@/hooks/use-mobile-navigation'
import type { Organization, User } from '@/types'

const STORAGE_KEY = 'freedraw:sidebar'

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === 'collapsed'
}

/**
 * Floating, collapsible navigation sidebar shown over the board (and reused as
 * the chrome on settings pages) for signed-in users.
 *
 * Matches the board's glass overlay aesthetic (the bottom bar / links-bar share
 * the same `bg-background/90 ... backdrop-blur` treatment). Renders nothing for
 * guests. When collapsed it shrinks to an icon-only rail. The collapsed state is
 * persisted to localStorage and read synchronously on mount so it never flickers
 * on reload.
 */
export function BoardSidebar() {
  const page = usePage()
  const user = page.props.auth?.user ?? null
  const currentOrganization = page.props.currentOrganization ?? null
  const organizations = page.props.organizations ?? []
  const cleanup = useMobileNavigation()

  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)

  // A signed-in sidebar reserves space so edge-anchored chrome keeps clear of
  // it; the collapsed rail is narrower. Run before paint to avoid a flash of
  // mis-positioned chrome on first render.
  const width = !user ? '0px' : collapsed ? '3.75rem' : '15.75rem'
  useLayoutEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded')
    document.documentElement.style.setProperty('--board-sidebar-width', width)
    return () => {
      document.documentElement.style.removeProperty('--board-sidebar-width')
    }
  }, [collapsed, width])

  const toggle = useCallback(() => setCollapsed((value) => !value), [])

  const switchOrganization = useCallback((organization: Organization) => {
    // Switching organizations always returns the user to the home board.
    router.visit(
      `/settings/organizations/${encodeURIComponent(organization.slug)}/switch`,
      {
        method: 'post',
        onSuccess: () => router.visit('/'),
      },
    )
  }, [])

  const handleLogout = useCallback(() => {
    cleanup()
    router.flushAll()
  }, [cleanup])

  // Guests keep the original board chrome (login lives in the bottom bar menu).
  if (!user) return null

  // Shared dropdown bodies so the expanded rows and the collapsed icon buttons
  // open exactly the same menus.
  const organizationMenu = (
    <DropdownMenuContent
      className="min-w-56"
      align="start"
      side={collapsed ? 'right' : 'bottom'}
    >
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Organizations
      </DropdownMenuLabel>
      {organizations.map((organization) => (
        <DropdownMenuItem
          key={organization.id}
          data-test="board-organization-switcher-item"
          className="cursor-pointer gap-2"
          onSelect={() => switchOrganization(organization)}
        >
          <span className="flex-1 truncate">{organization.name}</span>
          {currentOrganization?.id === organization.id && <Check className="size-4" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <CreateOrganizationModal>
        <DropdownMenuItem
          data-test="board-organization-switcher-new-organization"
          className="cursor-pointer gap-2"
          onSelect={(event) => event.preventDefault()}
        >
          <Plus className="size-4" />
          <span className="text-muted-foreground">New organization</span>
        </DropdownMenuItem>
      </CreateOrganizationModal>
    </DropdownMenuContent>
  )

  const userMenu = (
    <DropdownMenuContent
      className="min-w-56"
      align="start"
      side={collapsed ? 'right' : 'top'}
    >
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <UserInfo user={user} showEmail={true} />
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link
            className="block w-full cursor-pointer"
            href="/settings/profile"
            prefetch
            onClick={cleanup}
          >
            <Settings className="mr-2" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link
          className="block w-full cursor-pointer"
          href="/logout"
          method="post"
          as="button"
          onClick={handleLogout}
          data-test="board-sidebar-logout"
        >
          <LogOut className="mr-2" />
          Log out
        </Link>
      </DropdownMenuItem>
    </DropdownMenuContent>
  )

  if (collapsed) {
    return (
      <div className="pointer-events-auto flex h-full w-12 flex-col items-center gap-1 rounded-lg border bg-background/90 p-1.5 shadow-sm backdrop-blur">
        <Link href="/" prefetch aria-label="Home" className="mb-1 flex size-9 items-center justify-center">
          <AppLogoIcon className="size-7 rounded-md" />
        </Link>

        <RailButton onClick={toggle} label="Expand sidebar">
          <PanelLeftOpen />
        </RailButton>

        <RailLink href="/" label="Home" prefetch>
          <House />
        </RailLink>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={currentOrganization?.name ?? 'Select organization'}
              title={currentOrganization?.name ?? 'Select organization'}
              data-test="board-organization-switcher-trigger"
              className={railButtonClass}
            >
              <Users />
            </button>
          </DropdownMenuTrigger>
          {organizationMenu}
        </DropdownMenu>

        <RailLink href="/settings/profile" label="Settings" prefetch onClick={cleanup}>
          <Settings />
        </RailLink>

        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                title={user.name}
                data-test="board-sidebar-user-menu"
                className="flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent data-[state=open]:bg-accent"
              >
                <UserAvatar user={user} />
              </button>
            </DropdownMenuTrigger>
            {userMenu}
          </DropdownMenu>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto flex h-full w-60 flex-col gap-2 rounded-lg border bg-background/90 p-2 shadow-sm backdrop-blur">
      {/* Header: brand (links home) + collapse toggle */}
      <div className="flex items-center justify-between gap-2 px-1">
        <Link
          href="/"
          prefetch
          aria-label="Home"
          className="flex min-w-0 items-center gap-1.5 rounded-md px-1 text-sm font-semibold transition-colors hover:text-foreground/70"
        >
          <AppLogoIcon className="size-5 shrink-0 rounded" />
          <span className="truncate">FreeDraw</span>
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4"
        >
          <PanelLeftClose />
        </button>
      </div>

      {/* Home (top) */}
      <nav className="flex flex-col gap-0.5">
        <Link
          href="/"
          prefetch
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <House className="size-4 shrink-0 text-foreground/70" />
          <span className="truncate">Home</span>
        </Link>
      </nav>

      {/* Organization switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-test="board-organization-switcher-trigger"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent data-[state=open]:bg-accent"
          >
            <Users className="size-4 shrink-0 text-foreground/70" />
            <span className="flex-1 truncate font-medium">
              {currentOrganization?.name ?? 'Select organization'}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        {organizationMenu}
      </DropdownMenu>

      <nav className="flex flex-col gap-0.5">
        <Link
          href="/settings/profile"
          prefetch
          onClick={cleanup}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
        >
          <Settings className="size-4 shrink-0 text-foreground/70" />
          <span className="truncate">Settings</span>
        </Link>
      </nav>

      {/* Footer: user menu */}
      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-test="board-sidebar-user-menu"
              className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm transition-colors hover:bg-accent data-[state=open]:bg-accent"
            >
              <UserInfo user={user} showEmail={true} />
              <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          {userMenu}
        </DropdownMenu>
      </div>
    </div>
  )
}

const railButtonClass =
  'flex size-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground [&_svg]:size-4'

function RailButton({
  label,
  children,
  className,
  ...props
}: {
  label: string
  children: ReactNode
  className?: string
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(railButtonClass, className)}
      {...props}
    >
      {children}
    </button>
  )
}

function RailLink({
  href,
  label,
  children,
  ...props
}: {
  href: string
  label: string
  children: ReactNode
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'children'>) {
  return (
    <RailTooltip label={label}>
      <Link href={href} aria-label={label} className={railButtonClass} {...props}>
        {children}
      </Link>
    </RailTooltip>
  )
}

function RailTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function UserAvatar({ user }: { user: User }) {
  const getInitials = useInitials()
  const showAvatar = Boolean(user.avatar && user.avatar !== '')

  return (
    <Avatar className="size-7 overflow-hidden rounded-lg">
      {showAvatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
      <AvatarFallback className="rounded-lg text-xs text-black dark:text-white">
        {getInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export { readCollapsed as readBoardSidebarCollapsed }
