import { Link, router, usePage } from '@inertiajs/react'
import { LogIn, LogOut, Settings, User as UserIcon, UserPlus } from 'lucide-react'
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
import { UserInfo } from '@/components/user-info'
import { useInitials } from '@/hooks/use-initials'
import { useMobileNavigation } from '@/hooks/use-mobile-navigation'

export function BoardUserMenu() {
  const page = usePage()
  const user = page.props.auth?.user ?? null
  const getInitials = useInitials()
  const cleanup = useMobileNavigation()

  const handleLogout = () => {
    cleanup()
    router.flushAll()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground coarse:h-11 coarse:w-11 [&_svg]:size-4"
        >
          {user ? (
            <Avatar className="size-6 overflow-hidden rounded-full">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-full bg-neutral-200 text-xs text-black dark:bg-neutral-700 dark:text-white">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <UserIcon />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start" side="top">
        {user ? (
          <>
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
                data-test="logout-button"
              >
                <LogOut className="mr-2" />
                Log out
              </Link>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link className="block w-full cursor-pointer" href="/login" onClick={cleanup}>
                <LogIn className="mr-2" />
                Log in
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="block w-full cursor-pointer" href="/register" onClick={cleanup}>
                <UserPlus className="mr-2" />
                Register
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
