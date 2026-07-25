<?php

use App\Enums\OrganizationRole;
use App\Enums\PagePermission;
use App\Models\Page;
use App\Models\PageSnapshot;
use App\Models\User;

test('version index returns only labeled snapshots for the page newest first', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    PageSnapshot::factory()->for($page)->create(['label' => null, 'up_to_seq' => 5]);

    $older = PageSnapshot::factory()->for($page)->labelled('v1')->create([
        'up_to_seq' => 10,
        'created_by' => $user->id,
        'created_at' => now()->subMinute(),
    ]);

    $newer = PageSnapshot::factory()->for($page)->labelled('v2')->create([
        'up_to_seq' => 20,
        'created_by' => $user->id,
        'created_at' => now(),
    ]);

    $otherPage = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    PageSnapshot::factory()->for($otherPage)->labelled('other')->create();

    $response = $this
        ->actingAs($user)
        ->getJson(route('pages.versions.index', $page));

    $response
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.id', $newer->id)
        ->assertJsonPath('0.label', 'v2')
        ->assertJsonPath('0.upToSeq', 20)
        ->assertJsonPath('0.creator.id', $user->id)
        ->assertJsonPath('1.id', $older->id);

    expect($response->json('0'))->not->toHaveKey('state');
});

test('version index is forbidden for users who cannot access the page', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $otherUser->current_organization_id,
        'created_by' => $otherUser->id,
    ]);

    $this
        ->actingAs($user)
        ->getJson(route('pages.versions.index', $page))
        ->assertForbidden();
});

test('version show returns the base64 encoded state of a labeled snapshot', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    $version = PageSnapshot::factory()->for($page)->labelled('v1')->create([
        'up_to_seq' => 12,
        'state' => 'v1-state',
        'created_by' => $user->id,
    ]);

    $this
        ->actingAs($user)
        ->getJson(route('pages.versions.show', ['page' => $page, 'version' => $version]))
        ->assertOk()
        ->assertJsonPath('id', $version->id)
        ->assertJsonPath('label', 'v1')
        ->assertJsonPath('upToSeq', 12)
        ->assertJsonPath('creator.id', $user->id)
        ->assertJsonPath('state', base64_encode('v1-state'));
});

test('version show rejects unlabeled snapshots and snapshots of another page', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    $unlabeled = PageSnapshot::factory()->for($page)->create(['label' => null, 'up_to_seq' => 6]);

    $otherPage = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    $foreign = PageSnapshot::factory()->for($otherPage)->labelled('v1')->create();

    $this
        ->actingAs($user)
        ->getJson(route('pages.versions.show', ['page' => $page, 'version' => $unlabeled]))
        ->assertNotFound();

    $this
        ->actingAs($user)
        ->getJson(route('pages.versions.show', ['page' => $page, 'version' => $foreign]))
        ->assertNotFound();
});

test('version show is forbidden for users who cannot access the page', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $otherUser->current_organization_id,
        'created_by' => $otherUser->id,
    ]);
    $version = PageSnapshot::factory()->for($page)->labelled('v1')->create();

    $this
        ->actingAs($user)
        ->getJson(route('pages.versions.show', ['page' => $page, 'version' => $version]))
        ->assertForbidden();
});

test('storing a version copies the current head snapshot with a label', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 3, 'state' => 'old-state', 'label' => null]);
    $head = PageSnapshot::factory()->for($page)->create(['up_to_seq' => 9, 'state' => 'head-state', 'label' => null]);

    $response = $this
        ->actingAs($user)
        ->postJson(route('pages.versions.store', $page), [
            'label' => 'Milestone',
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('label', 'Milestone')
        ->assertJsonPath('upToSeq', 9)
        ->assertJsonPath('creator.id', $user->id);

    $this->assertDatabaseHas('page_snapshots', [
        'page_id' => $page->id,
        'label' => 'Milestone',
        'up_to_seq' => 9,
        'created_by' => $user->id,
    ]);

    $created = PageSnapshot::where('label', 'Milestone')->firstOrFail();

    expect($created->state)->toBe('head-state')
        ->and($created->id)->not->toBe($head->id)
        ->and($page->snapshots()->count())->toBe(3);
});

test('storing a version fails when the page has no snapshot yet', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    $response = $this
        ->actingAs($user)
        ->postJson(route('pages.versions.store', $page), ['label' => 'v1'])
        ->assertStatus(422);

    expect($response->exception?->getMessage())->toBe('no snapshot to label yet')
        ->and(PageSnapshot::where('page_id', $page->id)->count())->toBe(0);
});

test('storing a version is forbidden for members without edit permission', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $member->switchOrganization($organization);

    $page = Page::factory()->sharedWithOrganization(PagePermission::View)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);
    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 4]);

    $this
        ->actingAs($member)
        ->postJson(route('pages.versions.store', $page), ['label' => 'v1'])
        ->assertForbidden();
});

test('restoring a version appends a new head snapshot without deleting anything', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    $version = PageSnapshot::factory()->for($page)->labelled('v1')->create([
        'up_to_seq' => 5,
        'state' => 'v1-state',
        'created_by' => $user->id,
    ]);
    $head = PageSnapshot::factory()->for($page)->create([
        'up_to_seq' => 30,
        'state' => 'head-state',
        'label' => null,
    ]);

    $countBefore = PageSnapshot::where('page_id', $page->id)->count();

    $response = $this
        ->actingAs($user)
        ->postJson(route('pages.versions.restore', $page), [
            'version_id' => $version->id,
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('label', null)
        ->assertJsonPath('upToSeq', 30)
        ->assertJsonPath('creator.id', $user->id);

    expect(PageSnapshot::where('page_id', $page->id)->count())->toBe($countBefore + 1)
        ->and($version->fresh())->not->toBeNull()
        ->and($head->fresh())->not->toBeNull();

    $restored = PageSnapshot::where('page_id', $page->id)->latest('id')->first();

    expect($restored->state)->toBe('v1-state')
        ->and($restored->up_to_seq)->toBe(30)
        ->and($restored->label)->toBeNull();
});

test('restoring a version is forbidden for members without edit permission', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $member->switchOrganization($organization);

    $page = Page::factory()->sharedWithOrganization(PagePermission::View)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);
    $version = PageSnapshot::factory()->for($page)->labelled('v1')->create(['up_to_seq' => 5]);

    $this
        ->actingAs($member)
        ->postJson(route('pages.versions.restore', $page), ['version_id' => $version->id])
        ->assertForbidden();
});

test('restoring rejects a version that is not a labeled snapshot of the page', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 5]);

    $unlabeled = PageSnapshot::factory()->for($page)->create(['label' => null, 'up_to_seq' => 6]);

    $otherPage = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    $foreign = PageSnapshot::factory()->for($otherPage)->labelled('v1')->create();

    $this
        ->actingAs($user)
        ->postJson(route('pages.versions.restore', $page), ['version_id' => $unlabeled->id])
        ->assertInvalid(['version_id']);

    $this
        ->actingAs($user)
        ->postJson(route('pages.versions.restore', $page), ['version_id' => $foreign->id])
        ->assertInvalid(['version_id']);

    expect(PageSnapshot::where('page_id', $page->id)->count())->toBe(2);
});
