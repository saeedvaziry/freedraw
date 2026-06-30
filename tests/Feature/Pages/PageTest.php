<?php

use App\Enums\OrganizationRole;
use App\Enums\PagePermission;
use App\Models\Page;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

test('guests can render the local board without a database page', function () {
    $response = $this->get(route('home'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('board')
            ->where('boardPage', null)
            ->where('boardPages', []),
        );
});

test('authenticated users without pages render the board so the client can create one', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->get(route('home'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('board')
            ->where('boardPage', null)
            ->where('boardPages', []),
        );
});

test('authenticated users are redirected from home to their latest page', function () {
    $user = User::factory()->create();
    $organization = $user->currentOrganization;

    $olderPage = Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $user->id,
        'updated_at' => now()->subDay(),
    ]);
    $latestPage = Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $user->id,
        'updated_at' => now(),
    ]);

    $response = $this
        ->actingAs($user)
        ->get(route('home'));

    $response->assertRedirect(route('pages.show', $latestPage));
    expect($olderPage->exists)->toBeTrue();
});

test('pages can be created in the current organization', function () {
    $user = User::factory()->create();
    $document = base64_encode('yjs-update');

    $response = $this
        ->actingAs($user)
        ->postJson(route('pages.store'), [
            'title' => 'Sketch',
            'document' => $document,
        ]);

    $response
        ->assertCreated()
        ->assertJsonPath('title', 'Sketch')
        ->assertJsonPath('document', $document)
        ->assertJsonPath('organizationId', $user->current_organization_id);

    $publicId = $response->json('publicId');

    expect($response->json())->not->toHaveKey('id');
    expect($publicId)->toBeString();
    expect(Str::isUuid($publicId))->toBeTrue();
    expect($response->json('url'))->toContain($publicId);

    $this->assertDatabaseHas('pages', [
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
        'title' => 'Sketch',
        'document' => $document,
    ]);
});

test('page documents can be updated by members when shared with edit permission', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $member->switchOrganization($organization);

    $page = Page::factory()->sharedWithOrganization(PagePermission::Edit)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
        'document' => base64_encode('old'),
    ]);

    $response = $this
        ->actingAs($member)
        ->patchJson(route('pages.update', $page), [
            'document' => base64_encode('new'),
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('document', base64_encode('new'));

    expect($page->fresh()->document)->toBe(base64_encode('new'));
});

test('pages can be renamed by organization members', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
        'title' => 'Original',
    ]);

    $response = $this
        ->actingAs($user)
        ->patchJson(route('pages.update', $page), [
            'title' => 'Roadmap',
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('title', 'Roadmap');

    expect($page->fresh()->title)->toBe('Roadmap');
});

test('blank page titles are normalized when renaming', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
        'title' => 'Original',
    ]);

    $this
        ->actingAs($user)
        ->patchJson(route('pages.update', $page), [
            'title' => '   ',
        ])
        ->assertOk()
        ->assertJsonPath('title', 'Untitled page');

    expect($page->fresh()->title)->toBe('Untitled page');
});

test('pages can be deleted by organization members', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    $remainingPage = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
        'updated_at' => now()->addMinute(),
    ]);

    $response = $this
        ->actingAs($user)
        ->deleteJson(route('pages.destroy', $page));

    $response
        ->assertOk()
        ->assertJsonPath('redirectUrl', route('pages.show', $remainingPage));

    $this->assertDatabaseMissing('pages', [
        'id' => $page->id,
    ]);
});

test('deleting the final page redirects back home', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    $this
        ->actingAs($user)
        ->deleteJson(route('pages.destroy', $page))
        ->assertOk()
        ->assertJsonPath('redirectUrl', route('home'));

    $this->assertDatabaseMissing('pages', [
        'id' => $page->id,
    ]);
});

test('users cannot access pages outside their organizations', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $otherUser->current_organization_id,
        'created_by' => $otherUser->id,
    ]);

    $this
        ->actingAs($user)
        ->get(route('pages.show', $page))
        ->assertForbidden();

    $this
        ->actingAs($user)
        ->patchJson(route('pages.update', $page), ['document' => base64_encode('new')])
        ->assertForbidden();
});

test('page show returns the selected page and organization pages', function () {
    $user = User::factory()->create();
    $organization = $user->currentOrganization;
    $page = Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $user->id,
        'title' => 'Planning',
        'document' => base64_encode('doc'),
    ]);

    $response = $this
        ->actingAs($user)
        ->get(route('pages.show', $page));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('board')
            ->where('boardPage.publicId', $page->public_id)
            ->where('boardPage.title', 'Planning')
            ->where('boardPage.document', base64_encode('doc'))
            ->where('boardPages.0.document', null)
            ->where('boardPages.0.publicId', $page->public_id)
            ->missing('boardPage.id')
            ->missing('boardPages.0.id'),
        );
});

test('page URLs use the public id instead of the numeric primary key', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    expect(Str::isUuid($page->public_id))->toBeTrue();
    expect(route('pages.show', $page))->toContain('/pages/'.$page->public_id);
    expect(route('pages.show', $page))->not->toContain('/pages/'.$page->id.'?');
    expect(route('pages.show', $page))->not->toEndWith('/pages/'.$page->id);

    $this
        ->actingAs($user)
        ->get('/pages/'.$page->id)
        ->assertNotFound();
});
