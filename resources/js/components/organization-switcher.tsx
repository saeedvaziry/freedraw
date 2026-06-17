import { router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Plus, Users } from 'lucide-react';
import CreateOrganizationModal from '@/components/create-organization-modal';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Organization } from '@/types';

type OrganizationSwitcherProps = {
    inHeader?: boolean;
};

export function OrganizationSwitcher({ inHeader = false }: OrganizationSwitcherProps) {
    const page = usePage();
    const isMobile = useIsMobile();
    const currentOrganization = page.props.currentOrganization;
    const organizations = page.props.organizations ?? [];

    const switchOrganization = (organization: Organization) => {
        const previousOrganizationSlug = currentOrganization?.slug;

        router.visit(
            `/settings/organizations/${encodeURIComponent(organization.slug)}/switch`,
            {
                method: 'post',
                onFinish: () => {
                    if (!previousOrganizationSlug || typeof window === 'undefined') {
                        router.reload();

                        return;
                    }

                    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                    const segment = `/${previousOrganizationSlug}`;

                    if (currentUrl.includes(segment)) {
                        router.visit(
                            currentUrl.replace(segment, `/${organization.slug}`),
                            {
                                replace: true,
                            },
                        );

                        return;
                    }

                    router.reload();
                },
            },
        );
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    data-test="organization-switcher-trigger"
                    className={
                        inHeader
                            ? 'h-8 gap-1 px-2'
                            : 'w-full justify-start px-2 has-[>svg]:px-2 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
                    }
                >
                    <Users
                        className={
                            inHeader
                                ? 'hidden'
                                : 'hidden size-4 shrink-0 group-data-[collapsible=icon]:block'
                        }
                    />
                    <div
                        className={
                            inHeader
                                ? 'grid flex-1 text-left text-sm leading-tight'
                                : 'grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden'
                        }
                    >
                        <span
                            className={
                                inHeader
                                    ? 'max-w-[120px] truncate font-medium'
                                    : 'truncate font-semibold'
                            }
                        >
                            {currentOrganization?.name ?? 'Select organization'}
                        </span>
                    </div>
                    <ChevronsUpDown
                        className={
                            inHeader
                                ? 'size-4 opacity-50'
                                : 'ml-auto group-data-[collapsible=icon]:hidden'
                        }
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className={
                    inHeader
                        ? 'w-56'
                        : 'w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
                }
                side={inHeader ? undefined : isMobile ? 'bottom' : 'right'}
                align={inHeader ? 'end' : 'start'}
                sideOffset={inHeader ? undefined : 4}
            >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Organizations
                </DropdownMenuLabel>
                {organizations.map((organization) => (
                    <DropdownMenuItem
                        key={organization.id}
                        data-test="organization-switcher-item"
                        className={
                            inHeader
                                ? 'cursor-pointer gap-2'
                                : 'cursor-pointer gap-2 p-2'
                        }
                        onSelect={() => switchOrganization(organization)}
                    >
                        {organization.name}
                        {currentOrganization?.id === organization.id && (
                            <Check
                                className={
                                    inHeader
                                        ? 'ml-auto size-4'
                                        : 'ml-auto h-4 w-4'
                                }
                            />
                        )}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <CreateOrganizationModal>
                    <DropdownMenuItem
                        data-test="organization-switcher-new-organization"
                        className={
                            inHeader
                                ? 'cursor-pointer gap-2'
                                : 'cursor-pointer gap-2 p-2'
                        }
                        onSelect={(event) => event.preventDefault()}
                    >
                        <Plus className={inHeader ? 'size-4' : 'h-4 w-4'} />
                        <span className="text-muted-foreground">New organization</span>
                    </DropdownMenuItem>
                </CreateOrganizationModal>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
