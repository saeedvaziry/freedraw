<?php

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;

test('organization member roles can be updated by owners', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::factory()->create();

    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    $response = $this
        ->actingAs($owner)
        ->patch(route('organizations.members.update', [$organization, $member]), [
            'role' => OrganizationRole::Admin->value,
        ]);

    $response->assertRedirect(route('organizations.edit', $organization));

    expect($organization->members()->where('user_id', $member->id)->first()->pivot->role->value)->toEqual(OrganizationRole::Admin->value);
});

test('organization member roles cannot be updated by non owners', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::factory()->create();

    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    $response = $this
        ->actingAs($admin)
        ->patch(route('organizations.members.update', [$organization, $member]), [
            'role' => OrganizationRole::Admin->value,
        ]);

    $response->assertForbidden();
});

test('organization members can be removed by owners', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::factory()->create();

    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    $response = $this
        ->actingAs($owner)
        ->delete(route('organizations.members.destroy', [$organization, $member]));

    $response->assertRedirect(route('organizations.edit', $organization));

    expect($member->fresh()->belongsToOrganization($organization))->toBeFalse();
});

test('organization members cannot be removed by non owners', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::factory()->create();

    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $organization->members()->attach($admin, ['role' => OrganizationRole::Admin->value]);
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    $response = $this
        ->actingAs($admin)
        ->delete(route('organizations.members.destroy', [$organization, $member]));

    $response->assertForbidden();
});

test('organization owner cannot be removed', function () {
    $owner = User::factory()->create();
    $organization = Organization::factory()->create();

    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);

    $response = $this
        ->actingAs($owner)
        ->delete(route('organizations.members.destroy', [$organization, $owner]));

    $response->assertForbidden();

    expect($owner->fresh()->belongsToOrganization($organization))->toBeTrue();
});

test('organization member role cannot be set to owner', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = Organization::factory()->create();

    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    $response = $this
        ->actingAs($owner)
        ->patch(route('organizations.members.update', [$organization, $member]), [
            'role' => OrganizationRole::Owner->value,
        ]);

    $response->assertSessionHasErrors('role');

    expect($organization->members()->where('user_id', $member->id)->first()->pivot->role->value)->toEqual(OrganizationRole::Member->value);
});

test('removed member current organization is set to personal organization', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $personalOrganization = $member->personalOrganization();
    $organization = Organization::factory()->create();

    $organization->members()->attach($owner, ['role' => OrganizationRole::Owner->value]);
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);

    $member->update(['current_organization_id' => $organization->id]);

    $this
        ->actingAs($owner)
        ->delete(route('organizations.members.destroy', [$organization, $member]));

    expect($member->fresh()->current_organization_id)->toEqual($personalOrganization->id);
});