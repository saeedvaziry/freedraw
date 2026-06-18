import { Head, Link } from '@inertiajs/react';
import { Eye, LogOut, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import CreateOrganizationModal from '@/components/create-organization-modal';
import Heading from '@/components/heading';
import LeaveOrganizationModal from '@/components/leave-organization-modal';
import PendingInvitationsModal from '@/components/pending-invitations-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PendingInvitation, Organization } from '@/types';

type Props = {
    organizations: Organization[];
    pendingInvitations?: PendingInvitation[];
};

const organizationsUrl = '/settings/organizations';
const organizationUrl = (organizationSlug: string) =>
    `${organizationsUrl}/${encodeURIComponent(organizationSlug)}`;

export default function OrganizationsIndex({
    organizations,
    pendingInvitations = [],
}: Props) {
    const [leaveOrganizationDialogOpen, setLeaveOrganizationDialogOpen] =
        useState(false);
    const [organizationLeaving, setOrganizationLeaving] =
        useState<Organization | null>(null);
    const [showInvitations, setShowInvitations] = useState(
        pendingInvitations.length > 0,
    );

    const openLeaveOrganizationDialog = (organization: Organization) => {
        setOrganizationLeaving(organization);
        setLeaveOrganizationDialogOpen(true);
    };

    return (
        <>
            <Head title="Organizations" />

            <PendingInvitationsModal
                invitations={pendingInvitations}
                open={pendingInvitations.length > 0 && showInvitations}
                onOpenChange={setShowInvitations}
            />

            <h1 className="sr-only">Organizations</h1>

            <div className="flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                    <Heading
                        variant="small"
                        title="Organizations"
                        description="Manage your organizations and organization memberships"
                    />

                    <CreateOrganizationModal>
                        <Button data-test="organizations-new-organization-button">
                            <Plus /> New organization
                        </Button>
                    </CreateOrganizationModal>
                </div>

                <div className="space-y-3">
                    {organizations.map((organization) => {
                        const canLeaveOrganization =
                            !organization.isPersonal &&
                            organization.role !== 'owner';

                        return (
                            <div
                                key={organization.id}
                                data-test="organization-row"
                                className="flex items-center justify-between gap-4 rounded-lg border p-4"
                            >
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {organization.name}
                                            </span>
                                            {organization.isPersonal ? (
                                                <Badge variant="secondary">
                                                    Personal
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {organization.roleLabel}
                                        </span>
                                    </div>
                                </div>

                                <TooltipProvider>
                                    <div className="flex items-center gap-2">
                                        {canLeaveOrganization ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        data-test="organization-leave-button"
                                                        onClick={() =>
                                                            openLeaveOrganizationDialog(
                                                                organization,
                                                            )
                                                        }
                                                    >
                                                        <LogOut className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Leave organization</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : null}

                                        {organization.role === 'member' ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        data-test="organization-view-button"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={organizationUrl(
                                                                organization.slug,
                                                            )}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>View organization</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        data-test="organization-edit-button"
                                                        asChild
                                                    >
                                                        <Link
                                                            href={organizationUrl(
                                                                organization.slug,
                                                            )}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Edit organization</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </TooltipProvider>
                            </div>
                        );
                    })}

                    {organizations.length === 0 ? (
                        <p className="py-8 text-center text-muted-foreground">
                            You don't belong to any organizations yet.
                        </p>
                    ) : null}
                </div>
            </div>

            <LeaveOrganizationModal
                organization={organizationLeaving}
                open={leaveOrganizationDialogOpen}
                onOpenChange={setLeaveOrganizationDialogOpen}
            />
        </>
    );
}

OrganizationsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Organizations',
            href: organizationsUrl,
        },
    ],
};
