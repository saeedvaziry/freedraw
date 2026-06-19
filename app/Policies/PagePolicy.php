<?php

namespace App\Policies;

use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Models\Page;
use App\Models\User;

class PagePolicy
{
    /**
     * Determine whether the user can view the page.
     *
     * The creator and organization admins always have access. Other members
     * only see the page when it has been shared with the organization or
     * published publicly.
     */
    public function view(User $user, Page $page): bool
    {
        if ($this->ownsOrAdministers($user, $page)) {
            return true;
        }

        return $page->visibility->isShared()
            && $user->belongsToOrganization($page->organization);
    }

    /**
     * Determine whether the user can update the page document or title.
     *
     * The creator and organization admins can always edit. Other members can
     * edit only when the page is shared with the organization with edit
     * permission. Public sharing never grants member edit rights on its own.
     */
    public function update(User $user, Page $page): bool
    {
        if ($this->ownsOrAdministers($user, $page)) {
            return true;
        }

        return $page->visibility === PageVisibility::Organization
            && $page->permission === PagePermission::Edit
            && $user->belongsToOrganization($page->organization);
    }

    /**
     * Determine whether the user can delete the page.
     *
     * Only the creator and organization admins may delete a page.
     */
    public function delete(User $user, Page $page): bool
    {
        return $this->ownsOrAdministers($user, $page);
    }

    /**
     * Determine whether the user can change the page's sharing settings.
     *
     * Only the creator and organization admins may manage sharing.
     */
    public function share(User $user, Page $page): bool
    {
        return $this->ownsOrAdministers($user, $page);
    }

    /**
     * Determine whether the user created or administers the page's organization.
     */
    private function ownsOrAdministers(User $user, Page $page): bool
    {
        return $user->id === $page->created_by
            || $user->administersOrganization($page->organization);
    }
}
