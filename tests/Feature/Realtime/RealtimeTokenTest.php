<?php

use App\Enums\OrganizationRole;
use App\Enums\PagePermission;
use App\Models\Page;
use App\Models\User;

if (! function_exists('decodeRealtimeTokenPayload')) {
    function decodeRealtimeTokenPayload(string $token): array
    {
        [$encoded] = explode('.', $token);

        return json_decode(base64_decode(strtr($encoded, '-_', '+/')), true);
    }
}

if (! function_exists('joinRealtimeOrganization')) {
    function joinRealtimeOrganization(User $user, $organization, OrganizationRole $role): void
    {
        $organization->members()->attach($user, ['role' => $role->value]);
        $user->switchOrganization($organization);
    }
}

test('guests cannot mint an authenticated realtime token', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $this->post(route('pages.realtime-token', $page))->assertRedirect(route('login'));
});

test('the page owner receives an editable token bound to the page room', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $response = $this->actingAs($owner)
        ->postJson(route('pages.realtime-token', $page))
        ->assertOk()
        ->assertJsonStructure(['token', 'expiresAt']);

    $payload = decodeRealtimeTokenPayload($response->json('token'));

    expect($payload['room'])->toBe($page->public_id)
        ->and($payload['uid'])->toBe($owner->id)
        ->and($payload['canEdit'])->toBeTrue();
});

test('a view-only member receives a read-only token', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinRealtimeOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->sharedWithOrganization()->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $response = $this->actingAs($member)
        ->postJson(route('pages.realtime-token', $page))
        ->assertOk();

    $payload = decodeRealtimeTokenPayload($response->json('token'));

    expect($payload['room'])->toBe($page->public_id)
        ->and($payload['uid'])->toBe($member->id)
        ->and($payload['canEdit'])->toBeFalse();
});

test('a member with edit permission receives an editable token', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinRealtimeOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->sharedWithOrganization(PagePermission::Edit)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $response = $this->actingAs($member)
        ->postJson(route('pages.realtime-token', $page))
        ->assertOk();

    expect(decodeRealtimeTokenPayload($response->json('token'))['canEdit'])->toBeTrue();
});

test('a member who cannot view the page is forbidden a token', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinRealtimeOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $this->actingAs($member)
        ->postJson(route('pages.realtime-token', $page))
        ->assertForbidden();
});

test('the public endpoint issues a read-only token for a public page', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->public()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $response = $this->postJson(route('share.realtime-token', $page->share_slug))
        ->assertOk()
        ->assertJsonStructure(['token', 'expiresAt']);

    $payload = decodeRealtimeTokenPayload($response->json('token'));

    expect($payload['room'])->toBe($page->public_id)
        ->and($payload['uid'])->toBeNull()
        ->and($payload['canEdit'])->toBeFalse();
});

test('the public endpoint rejects a non-public page slug', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->sharedWithOrganization()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
        'share_slug' => 'org-shared-slug',
    ]);

    $this->postJson(route('share.realtime-token', $page->share_slug))->assertNotFound();
});

test('the public endpoint rejects an unknown slug', function () {
    $this->postJson(route('share.realtime-token', 'does-not-exist'))->assertNotFound();
});

test('the authenticated endpoint is not found when collaboration is disabled', function () {
    config()->set('services.collab.enabled', false);

    $owner = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $this->actingAs($owner)
        ->postJson(route('pages.realtime-token', $page))
        ->assertNotFound();
});

test('the public endpoint is not found when collaboration is disabled', function () {
    config()->set('services.collab.enabled', false);

    $owner = User::factory()->create();
    $page = Page::factory()->public()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $this->postJson(route('share.realtime-token', $page->share_slug))->assertNotFound();
});
