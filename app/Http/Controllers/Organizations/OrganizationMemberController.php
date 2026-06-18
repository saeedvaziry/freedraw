<?php

namespace App\Http\Controllers\Organizations;

use App\Enums\OrganizationRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\UpdateOrganizationMemberRequest;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class OrganizationMemberController extends Controller
{
    /**
     * Update the specified organization member's role.
     */
    public function update(UpdateOrganizationMemberRequest $request, Organization $organization, User $user): RedirectResponse
    {
        Gate::authorize('updateMember', $organization);

        $newRole = OrganizationRole::from($request->validated('role'));

        $organization->memberships()
            ->where('user_id', $user->id)
            ->firstOrFail()
            ->update(['role' => $newRole]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member role updated.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Remove the specified organization member.
     */
    public function destroy(Organization $organization, User $user): RedirectResponse
    {
        Gate::authorize('removeMember', $organization);

        abort_if($organization->owner()?->is($user), 403, __('The organization owner cannot be removed.'));

        $organization->memberships()
            ->where('user_id', $user->id)
            ->delete();

        if ($user->isCurrentOrganization($organization)) {
            $user->switchOrganization($user->personalOrganization());
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member removed.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }
}
