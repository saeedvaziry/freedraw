<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Actions\Organizations\CancelOrganizationInvitation;
use App\Actions\Organizations\DeclineOrganizationInvitation;
use App\Actions\Organizations\InviteOrganizationMember;
use App\DTOs\Organizations\CancelOrganizationInvitationData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\CreateOrganizationInvitationRequest;
use App\Http\Requests\Organizations\RespondToOrganizationInvitationRequest;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Routing\Attributes\Controllers\Authorize;
use Illuminate\Routing\Attributes\Controllers\Middleware;
use Inertia\Inertia;

#[Middleware('auth')]
class OrganizationInvitationController extends Controller
{
    /**
     * Store a newly created invitation.
     */
    #[Authorize('inviteMember', 'organization')]
    public function store(CreateOrganizationInvitationRequest $request, Organization $organization, InviteOrganizationMember $inviteOrganizationMember): RedirectResponse
    {
        $inviteOrganizationMember->handle($request->toDto());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation sent.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Cancel the specified invitation.
     */
    #[Authorize('cancelInvitation', 'organization')]
    public function destroy(Organization $organization, OrganizationInvitation $invitation, CancelOrganizationInvitation $cancelOrganizationInvitation): RedirectResponse
    {
        $cancelOrganizationInvitation->handle(new CancelOrganizationInvitationData($organization, $invitation));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation cancelled.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Accept the invitation.
     */
    public function accept(RespondToOrganizationInvitationRequest $request, OrganizationInvitation $invitation, AcceptOrganizationInvitation $acceptOrganizationInvitation): RedirectResponse
    {
        $acceptOrganizationInvitation->handle($request->toDto());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation accepted.')]);

        return to_route('organizations.index');
    }

    /**
     * Decline the invitation.
     */
    public function decline(RespondToOrganizationInvitationRequest $request, OrganizationInvitation $invitation, DeclineOrganizationInvitation $declineOrganizationInvitation): RedirectResponse
    {
        $declineOrganizationInvitation->handle($request->toDto());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Invitation declined.')]);

        return to_route('organizations.index');
    }
}
