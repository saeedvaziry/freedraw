import { Link, router, usePage } from '@inertiajs/react'
import { Check, ChevronsUpDown, House, LogIn, LogOut, Menu, Plus, Settings, Share2, UserPlus, Users } from 'lucide-react'
import { Fragment, useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { shallowEqual, type SceneStore } from '@freedraw/engine'
import AppLogoIcon from '@/components/app-logo-icon'
import CreateOrganizationModal from '@/components/create-organization-modal'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { UserInfo } from '@/components/user-info'
import { FloatingPanel, IconButton, cn } from '@/components/board/ui-kit'
import { usePages } from '@/hooks/board/use-pages'
import { useMobileNavigation } from '@/hooks/use-mobile-navigation'
import type { Organization } from '@/types'
import { AppearanceSegmented } from './appearance-segmented.js'
import { BOARD_ACTIONS_BY_ID, type BoardAction, type BoardActionContext } from './board-actions.js'
import { useBoardContext } from './board-context.js'
import { PageRow } from './page-row.js'
import { SELECTION_ACTION_GROUPS } from './selection-toolbar/selection-toolbar.js'
import { SharePageModal } from './share-page-modal.js'

/**
 * Mobile navigation. The desktop sidebar is hidden on small screens, so this
 * exposes the same options — Home, organization switcher, pages, settings,
 * account — behind a top-left menu button that opens a left slide-in sheet.
 * Guests get log in / register instead.
 */
export function BoardMobileMenu() {
  const page = usePage()
  const user = page.props.auth?.user ?? null
  const currentOrganization = page.props.currentOrganization ?? null
  const organizations = page.props.organizations ?? []
  const cleanup = useMobileNavigation()

  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  const pages = usePages(close)

  const switchOrganization = useCallback(
    (organization: Organization) => {
      close()
      router.visit(`/settings/organizations/${encodeURIComponent(organization.slug)}/switch`, {
        method: 'post',
        onSuccess: () => router.visit('/'),
      })
    },
    [close],
  )

  const handleLogout = useCallback(() => {
    cleanup()
    router.flushAll()
  }, [cleanup])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <FloatingPanel className="pointer-events-auto">
        <SheetTrigger asChild>
          <IconButton aria-label="Menu" className="text-foreground/80 [&_svg]:size-5">
            <Menu />
          </IconButton>
        </SheetTrigger>
      </FloatingPanel>

      <SheetContent side="left" className="w-[18rem] gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b p-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <AppLogoIcon className="size-6 shrink-0 rounded" />
            <span>FreeDraw</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          <SelectionSection onRun={close} />

          <Link
            href="/"
            prefetch
            onClick={close}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
          >
            <House className="size-4 shrink-0 text-foreground/70" />
            <span className="truncate">Home</span>
          </Link>

          {user ? (
            <>
              <OrganizationSwitcher
                organizations={organizations}
                currentOrganization={currentOrganization}
                onSwitch={switchOrganization}
              />

              <div className="my-1 h-px bg-border" />

              <PagesSection pages={pages} onNavigate={close} />

              <div className="my-1 h-px bg-border" />

              <Link
                href="/settings/profile"
                prefetch
                onClick={() => {
                  cleanup()
                  close()
                }}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
              >
                <Settings className="size-4 shrink-0 text-foreground/70" />
                <span className="truncate">Settings</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={close}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
              >
                <LogIn className="size-4 shrink-0 text-foreground/70" />
                <span className="truncate">Log in</span>
              </Link>
              <Link
                href="/register"
                onClick={close}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
              >
                <UserPlus className="size-4 shrink-0 text-foreground/70" />
                <span className="truncate">Register</span>
              </Link>
            </>
          )}
        </div>

        <div className="border-t p-2">
          <AppearanceSegmented className="mb-1" />
          {user ? (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <UserInfo user={user} showEmail />
              <IconButton
                asChild
                aria-label="Log out"
                className="size-8 rounded-md text-foreground/70 coarse:size-8"
              >
                <Link
                  href="/logout"
                  method="post"
                  as="button"
                  onClick={handleLogout}
                  data-test="board-mobile-menu-logout"
                  title="Log out"
                >
                  <LogOut />
                </Link>
              </IconButton>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

interface SelectionState {
  count: number
  grouped: boolean
}

function readSelectionState(store: SceneStore): SelectionState {
  const ids = [...store.getUiState().selectedIds]
  const elements = store.getSnapshot().elements
  return {
    count: ids.length,
    grouped: ids.some((id) => elements[id]?.groupId != null),
  }
}

function SelectionSection({ onRun }: { onRun(): void }) {
  const board = useBoardContext()
  const view = useMemo(
    () =>
      board.store.select(readSelectionState, {
        equals: shallowEqual,
        channels: ['doc', 'selection'],
      }),
    [board.store],
  )
  const state = useSyncExternalStore(view.subscribe, view.getSnapshot)

  if (board.readOnly || state.count === 0) return null

  const ctx: BoardActionContext = {
    store: board.store,
    controller: board.controller,
    boardExport: board.boardExport,
    theme: board.theme,
    readOnly: board.readOnly,
    openImagePicker: () => {},
  }

  return (
    <>
      <div className="flex flex-col gap-0.5">
        <p className="px-2 py-1 text-xs font-normal text-muted-foreground">Selection</p>
        {SELECTION_ACTION_GROUPS.map((group, index) => (
          <Fragment key={group.join('|')}>
            {index > 0 ? <div className="my-1 h-px bg-border" /> : null}
            {group.map((id) => (
              <SelectionActionRow
                key={id}
                action={BOARD_ACTIONS_BY_ID[id]}
                ctx={ctx}
                onRun={onRun}
              />
            ))}
          </Fragment>
        ))}
      </div>

      <div className="my-1 h-px bg-border" />
    </>
  )
}

function SelectionActionRow({
  action,
  ctx,
  onRun,
}: {
  action: BoardAction
  ctx: BoardActionContext
  onRun(): void
}) {
  const Icon = action.icon
  return (
    <button
      type="button"
      disabled={!action.when(ctx)}
      data-test={`board-mobile-action-${action.id}`}
      onClick={() => {
        action.run(ctx)
        onRun()
      }}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
    >
      <Icon className="size-4 shrink-0 text-foreground/70" />
      <span className="truncate">{action.label}</span>
    </button>
  )
}

function OrganizationSwitcher({
  organizations,
  currentOrganization,
  onSwitch,
}: {
  organizations: Organization[]
  currentOrganization: Organization | null
  onSwitch(organization: Organization): void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        data-test="board-mobile-organization-switcher-trigger"
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
      >
        <Users className="size-4 shrink-0 text-foreground/70" />
        <span className="flex-1 truncate font-medium">
          {currentOrganization?.name ?? 'Select organization'}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>

      {expanded ? (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-2">
          {organizations.map((organization) => (
            <button
              key={organization.id}
              type="button"
              data-test="board-mobile-organization-switcher-item"
              onClick={() => onSwitch(organization)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                currentOrganization?.id === organization.id && 'text-foreground',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{organization.name}</span>
              {currentOrganization?.id === organization.id ? (
                <Check className="size-4 shrink-0 text-muted-foreground" />
              ) : null}
            </button>
          ))}
          <CreateOrganizationModal>
            <button
              type="button"
              data-test="board-mobile-organization-switcher-new-organization"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="size-4 shrink-0" />
              <span className="truncate">New organization</span>
            </button>
          </CreateOrganizationModal>
        </div>
      ) : null}
    </div>
  )
}

function PagesSection({
  pages,
  onNavigate,
}: {
  pages: ReturnType<typeof usePages>
  onNavigate(): void
}) {
  const {
    boardPages,
    activePage,
    editing,
    renameDraft,
    busy,
    creating,
    setRenameDraft,
    resetEditing,
    createPage,
    beginRename,
    beginDelete,
    saveRename,
    confirmDelete,
  } = pages
  const [shareOpen, setShareOpen] = useState(false)

  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2 py-1 text-xs font-normal text-muted-foreground">Pages</p>
      {boardPages.length === 0 ? (
        <p className="px-2 py-1.5 text-sm text-muted-foreground">
          No pages yet. Add one to get started.
        </p>
      ) : (
        boardPages.map((boardPage) => (
          <PageRow
            key={boardPage.publicId}
            boardPage={boardPage}
            active={activePage?.publicId === boardPage.publicId}
            mode={editing?.id === boardPage.publicId ? editing.mode : null}
            renameDraft={renameDraft}
            busy={busy}
            alwaysShowActions
            onRenameDraftChange={setRenameDraft}
            onBeginRename={beginRename}
            onSaveRename={saveRename}
            onBeginDelete={beginDelete}
            onConfirmDelete={confirmDelete}
            onCancel={resetEditing}
            onNavigate={onNavigate}
          />
        ))
      )}
      {activePage?.canShare ? (
        <button
          type="button"
          onClick={() => {
            onNavigate()
            setShareOpen(true)
          }}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Share2 className="size-4 shrink-0" />
          <span>Share page</span>
        </button>
      ) : null}
      <button
        type="button"
        disabled={creating}
        onClick={createPage}
        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-4 shrink-0" />
        <span>{creating ? 'Creating…' : 'New page'}</span>
      </button>
      {activePage ? (
        <SharePageModal boardPage={activePage} open={shareOpen} onOpenChange={setShareOpen} />
      ) : null}
    </div>
  )
}
