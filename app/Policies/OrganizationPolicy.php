<?php

namespace App\Policies;

use App\Enums\OrganizationPermission;
use App\Models\Organization;
use App\Models\User;

class OrganizationPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Organization $organization): bool
    {
        return $user->belongsToOrganization($organization);
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Organization $organization): bool
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::UpdateOrganization);
    }

    /**
     * Determine whether the user can leave the organization.
     */
    public function leave(User $user, Organization $organization): bool
    {
        return ! $organization->is_personal
            && $user->belongsToOrganization($organization)
            && ! $user->ownsOrganization($organization);
    }

    /**
     * Determine whether the user can add a member to the organization.
     */
    public function addMember(User $user, Organization $organization): bool
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::AddMember);
    }

    /**
     * Determine whether the user can update a member's role in the organization.
     */
    public function updateMember(User $user, Organization $organization): bool
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::UpdateMember);
    }

    /**
     * Determine whether the user can remove a member from the organization.
     */
    public function removeMember(User $user, Organization $organization): bool
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::RemoveMember);
    }

    /**
     * Determine whether the user can invite members to the organization.
     */
    public function inviteMember(User $user, Organization $organization): bool
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::CreateInvitation);
    }

    /**
     * Determine whether the user can cancel invitations.
     */
    public function cancelInvitation(User $user, Organization $organization): bool
    {
        return $user->hasOrganizationPermission($organization, OrganizationPermission::CancelInvitation);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Organization $organization): bool
    {
        return ! $organization->is_personal && $user->hasOrganizationPermission($organization, OrganizationPermission::DeleteOrganization);
    }
}
