<?php

use App\Actions\Organizations\AcceptOrganizationInvitation;
use App\Actions\Organizations\CancelOrganizationInvitation;
use App\Actions\Organizations\CreateOrganization;
use App\Actions\Organizations\DeclineOrganizationInvitation;
use App\Actions\Organizations\DeleteOrganization;
use App\Actions\Organizations\InviteOrganizationMember;
use App\Actions\Organizations\LeaveOrganization;
use App\Actions\Organizations\PruneExpiredOrganizationInvitations;
use App\Actions\Organizations\RemoveOrganizationMember;
use App\Actions\Organizations\SwitchOrganization;
use App\Actions\Organizations\UpdateOrganization;
use App\Actions\Organizations\UpdateOrganizationMember;
use App\DTOs\Organizations\CancelOrganizationInvitationData;
use App\DTOs\Organizations\CreateOrganizationData;
use App\DTOs\Organizations\DeleteOrganizationData;
use App\DTOs\Organizations\InviteOrganizationMemberData;
use App\DTOs\Organizations\LeaveOrganizationData;
use App\DTOs\Organizations\PruneExpiredOrganizationInvitationsData;
use App\DTOs\Organizations\RemoveOrganizationMemberData;
use App\DTOs\Organizations\RespondToOrganizationInvitationData;
use App\DTOs\Organizations\SwitchOrganizationData;
use App\DTOs\Organizations\UpdateOrganizationData;
use App\DTOs\Organizations\UpdateOrganizationMemberData;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

test('create organization adds the user as owner and switches current organization', function () {
    $user = User::factory()->create();

    $organization = app(CreateOrganization::class)->handle(new CreateOrganizationData(
        user: $user,
        name: 'Acme',
    ));

    expect($user->fresh()->current_organization_id)->toBe($organization->id)
        ->and($user->organizationRole($organization))->toBe(OrganizationRole::Owner);
});

test('update organization renames inside a transaction', function () {
    $organization = Organization::factory()->create(['name' => 'Old']);

    $updated = app(UpdateOrganization::class)->handle(new UpdateOrganizationData($organization, 'New'));

    expect($updated->name)->toBe('New');
});

test('invite organization member creates and notifies', function () {
    Notification::fake();

    $owner = User::factory()->create();
    $organization = Organization::factory()->create();

    $invitation = app(InviteOrganizationMember::class)->handle(new InviteOrganizationMemberData(
        inviter: $owner,
        organization: $organization,
        email: 'invite@example.com',
        role: OrganizationRole::Member,
    ));

    expect($invitation->email)->toBe('invite@example.com');

    Notification::assertSentOnDemand(OrganizationInvitationNotification::class);
});

test('accept and decline organization invitations update membership state', function () {
    $user = User::factory()->create(['email' => 'invite@example.com']);
    $organization = Organization::factory()->create();
    $accepted = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => $user->email,
    ]);
    $declined = OrganizationInvitation::factory()->create([
        'organization_id' => $organization->id,
        'email' => $user->email,
    ]);

    app(AcceptOrganizationInvitation::class)->handle(new RespondToOrganizationInvitationData($user, $accepted));
    app(DeclineOrganizationInvitation::class)->handle(new RespondToOrganizationInvitationData($user, $declined));

    expect($organization->memberships()->where('user_id', $user->id)->exists())->toBeTrue()
        ->and($accepted->fresh()->accepted_at)->not->toBeNull()
        ->and(OrganizationInvitation::whereKey($declined->id)->exists())->toBeFalse();
});

test('member role updates and removals are applied', function () {
    $member = User::factory()->create();
    $organization = Organization::factory()->create();
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $member->switchOrganization($organization);

    app(UpdateOrganizationMember::class)->handle(new UpdateOrganizationMemberData(
        organization: $organization,
        member: $member,
        role: OrganizationRole::Admin,
    ));

    app(RemoveOrganizationMember::class)->handle(new RemoveOrganizationMemberData($organization, $member));

    expect($member->organizationRole($organization))->toBeNull();
});

test('cancel and prune organization invitations remove only targeted rows', function () {
    $organization = Organization::factory()->create();
    $pending = OrganizationInvitation::factory()->create(['organization_id' => $organization->id]);
    $expired = OrganizationInvitation::factory()->expired()->create(['organization_id' => $organization->id]);
    $active = OrganizationInvitation::factory()->expiresIn(1)->create(['organization_id' => $organization->id]);

    app(CancelOrganizationInvitation::class)->handle(new CancelOrganizationInvitationData($organization, $pending));
    $deleted = app(PruneExpiredOrganizationInvitations::class)->handle(new PruneExpiredOrganizationInvitationsData);

    expect($deleted)->toBe(1)
        ->and(OrganizationInvitation::whereKey($pending->id)->exists())->toBeFalse()
        ->and(OrganizationInvitation::whereKey($expired->id)->exists())->toBeFalse()
        ->and(OrganizationInvitation::whereKey($active->id)->exists())->toBeTrue();
});

test('switch organization updates the current organization', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();
    $organization->members()->attach($user, ['role' => OrganizationRole::Member->value]);

    app(SwitchOrganization::class)->handle(new SwitchOrganizationData($user, $organization));

    expect($user->fresh()->current_organization_id)->toBe($organization->id);
});

test('leave organization removes membership and falls back to another organization', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create(['name' => 'Beta']);
    $organization->members()->attach($user, ['role' => OrganizationRole::Member->value]);
    $user->switchOrganization($organization);

    app(LeaveOrganization::class)->handle(new LeaveOrganizationData($user, $organization));

    expect($user->organizationRole($organization))->toBeNull()
        ->and($user->fresh()->current_organization_id)->not->toBe($organization->id);
});

test('delete organization removes memberships and switches current organization', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();
    $organization->members()->attach($user, ['role' => OrganizationRole::Owner->value]);
    $user->switchOrganization($organization);

    app(DeleteOrganization::class)->handle(new DeleteOrganizationData($user, $organization));

    expect(Organization::whereKey($organization->id)->exists())->toBeFalse()
        ->and($user->fresh()->current_organization_id)->not->toBe($organization->id);
});
