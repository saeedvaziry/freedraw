<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\RemoveOrganizationMember;
use App\Actions\Organizations\UpdateOrganizationMember;
use App\DTOs\Organizations\RemoveOrganizationMemberData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\UpdateOrganizationMemberRequest;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Routing\Attributes\Controllers\Authorize;
use Illuminate\Routing\Attributes\Controllers\Middleware;
use Inertia\Inertia;

#[Middleware('auth')]
class OrganizationMemberController extends Controller
{
    /**
     * Update the specified organization member's role.
     */
    #[Authorize('updateMember', 'organization')]
    public function update(UpdateOrganizationMemberRequest $request, Organization $organization, User $user, UpdateOrganizationMember $updateOrganizationMember): RedirectResponse
    {
        $updateOrganizationMember->handle($request->toDto());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member role updated.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Remove the specified organization member.
     */
    #[Authorize('removeMember', 'organization')]
    public function destroy(Organization $organization, User $user, RemoveOrganizationMember $removeOrganizationMember): RedirectResponse
    {
        $removeOrganizationMember->handle(new RemoveOrganizationMemberData($organization, $user));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Member removed.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }
}
