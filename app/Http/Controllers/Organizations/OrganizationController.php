<?php

namespace App\Http\Controllers\Organizations;

use App\Actions\Organizations\CreateOrganization;
use App\Actions\Organizations\DeleteOrganization;
use App\Actions\Organizations\LeaveOrganization;
use App\Actions\Organizations\SwitchOrganization;
use App\Actions\Organizations\UpdateOrganization;
use App\DTOs\Organizations\CreateOrganizationData;
use App\DTOs\Organizations\LeaveOrganizationData;
use App\DTOs\Organizations\SwitchOrganizationData;
use App\DTOs\Organizations\UpdateOrganizationData;
use App\Enums\OrganizationRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\DeleteOrganizationRequest;
use App\Http\Requests\Organizations\SaveOrganizationRequest;
use App\Http\Resources\Organizations\OrganizationInvitationResource;
use App\Http\Resources\Organizations\OrganizationMemberResource;
use App\Http\Resources\Organizations\OrganizationResource;
use App\Http\Resources\Organizations\PendingInvitationResource;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Attributes\Controllers\Authorize;
use Illuminate\Routing\Attributes\Controllers\Middleware;
use Inertia\Inertia;
use Inertia\Response;

#[Middleware('auth')]
class OrganizationController extends Controller
{
    /**
     * Display a listing of the user's organizations.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        $email = strtolower($user->email);

        $pendingInvitations = OrganizationInvitation::query()
            ->with(['inviter', 'organization'])
            ->whereRaw('LOWER(email) = ?', [$email])
            ->whereNull('accepted_at')
            ->where(fn ($query) => $query
                ->whereNull('expires_at')
                ->orWhere('expires_at', '>=', now()))
            ->latest()
            ->get()
            ->map(fn (OrganizationInvitation $invitation) => PendingInvitationResource::make($invitation)->resolve($request));

        return Inertia::render('organizations/index', [
            'organizations' => $user->toUserOrganizations(includeCurrent: true),
            'pendingInvitations' => $pendingInvitations,
        ]);
    }

    /**
     * Store a newly created organization.
     */
    public function store(SaveOrganizationRequest $request, CreateOrganization $createOrganization): RedirectResponse
    {
        $data = $request->toDto();
        assert($data instanceof CreateOrganizationData);

        $organization = $createOrganization->handle($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization created.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Show the organization edit page.
     */
    public function edit(Request $request, Organization $organization): Response
    {
        $user = $request->user();

        return Inertia::render('organizations/edit', [
            'organization' => OrganizationResource::make($organization)->resolve($request),
            'members' => $organization->members()->get()
                ->map(fn ($member) => OrganizationMemberResource::make($member)->resolve($request)),
            'invitations' => $organization->invitations()
                ->whereNull('accepted_at')
                ->get()
                ->map(fn ($invitation) => OrganizationInvitationResource::make($invitation)->resolve($request)),
            'permissions' => $user->toOrganizationPermissions($organization),
            'availableRoles' => OrganizationRole::assignable(),
        ]);
    }

    /**
     * Update the specified organization.
     */
    public function update(SaveOrganizationRequest $request, Organization $organization, UpdateOrganization $updateOrganization): RedirectResponse
    {
        $data = $request->toDto();
        assert($data instanceof UpdateOrganizationData);

        $organization = $updateOrganization->handle($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization updated.')]);

        return to_route('organizations.edit', ['organization' => $organization->slug]);
    }

    /**
     * Switch the user's current organization.
     */
    public function switch(Request $request, Organization $organization, SwitchOrganization $switchOrganization): RedirectResponse
    {
        abort_unless($request->user()->belongsToOrganization($organization), 403);

        $switchOrganization->handle(new SwitchOrganizationData($request->user(), $organization));

        return back();
    }

    /**
     * Leave the specified organization.
     */
    #[Authorize('leave', 'organization')]
    public function leave(Request $request, Organization $organization, LeaveOrganization $leaveOrganization): RedirectResponse
    {
        $leaveOrganization->handle(new LeaveOrganizationData($request->user(), $organization));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('You left the organization ":name"', ['name' => $organization->name])]);

        return to_route('organizations.index');
    }

    /**
     * Delete the specified organization.
     */
    public function destroy(DeleteOrganizationRequest $request, Organization $organization, DeleteOrganization $deleteOrganization): RedirectResponse
    {
        $deleteOrganization->handle($request->toDto());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Organization deleted.')]);

        return to_route('organizations.index');
    }
}
