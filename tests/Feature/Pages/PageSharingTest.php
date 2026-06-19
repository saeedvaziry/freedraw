<?php

use App\Enums\OrganizationRole;
use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Models\Page;
use App\Models\User;

/**
 * Attach a user to an organization with the given role and make it current.
 */
function joinOrganization(User $user, $organization, OrganizationRole $role): void
{
    $organization->members()->attach($user, ['role' => $role->value]);
    $user->switchOrganization($organization);
}

test('pages are private to their creator by default', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    expect($page->visibility)->toBe(PageVisibility::Private);

    $this->actingAs($member)->get(route('pages.show', $page))->assertForbidden();
    $this->actingAs($member)->patchJson(route('pages.update', $page), ['title' => 'x'])->assertForbidden();
    $this->actingAs($member)->deleteJson(route('pages.destroy', $page))->assertForbidden();
});

test('private pages are excluded from another members board list', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($member, $organization, OrganizationRole::Member);

    Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    // The member has no visible pages, so home renders the empty board.
    $this->actingAs($member)
        ->get(route('home'))
        ->assertOk();

    $visible = $organization->pages()->visibleTo($member)->count();
    expect($visible)->toBe(0);
});

test('organization members can view pages shared with the organization', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->sharedWithOrganization()->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $this->actingAs($member)->get(route('pages.show', $page))->assertOk();

    // View-only share does not grant edit.
    $this->actingAs($member)
        ->patchJson(route('pages.update', $page), ['title' => 'Nope'])
        ->assertForbidden();
});

test('organization members can edit pages shared with edit permission', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->sharedWithOrganization(PagePermission::Edit)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $this->actingAs($member)
        ->patchJson(route('pages.update', $page), ['title' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('title', 'Edited');
});

test('members with edit permission still cannot delete pages', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->sharedWithOrganization(PagePermission::Edit)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $this->actingAs($member)
        ->deleteJson(route('pages.destroy', $page))
        ->assertForbidden();

    $this->assertDatabaseHas('pages', ['id' => $page->id]);
});

test('organization admins can view, edit and delete any page without sharing', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($admin, $organization, OrganizationRole::Admin);

    $page = Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    expect($page->visibility)->toBe(PageVisibility::Private);

    $this->actingAs($admin)->get(route('pages.show', $page))->assertOk();
    $this->actingAs($admin)
        ->patchJson(route('pages.update', $page), ['title' => 'Admin edit'])
        ->assertOk();
    $this->actingAs($admin)
        ->deleteJson(route('pages.destroy', $page))
        ->assertOk();
});

test('the creator can change a pages sharing settings', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $response = $this
        ->actingAs($owner)
        ->patchJson(route('pages.share', $page), [
            'visibility' => PageVisibility::Organization->value,
            'permission' => PagePermission::Edit->value,
        ]);

    $response
        ->assertOk()
        ->assertJsonPath('visibility', PageVisibility::Organization->value)
        ->assertJsonPath('permission', PagePermission::Edit->value)
        ->assertJsonPath('shareUrl', null);

    expect($page->fresh()->visibility)->toBe(PageVisibility::Organization);
    expect($page->fresh()->permission)->toBe(PagePermission::Edit);
});

test('admins can change sharing settings of any page', function () {
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($admin, $organization, OrganizationRole::Admin);

    $page = Page::factory()->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $this->actingAs($admin)
        ->patchJson(route('pages.share', $page), [
            'visibility' => PageVisibility::Organization->value,
            'permission' => PagePermission::View->value,
        ])
        ->assertOk();
});

test('regular members cannot change sharing settings', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    joinOrganization($member, $organization, OrganizationRole::Member);

    $page = Page::factory()->sharedWithOrganization(PagePermission::Edit)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $this->actingAs($member)
        ->patchJson(route('pages.share', $page), [
            'visibility' => PageVisibility::Public->value,
            'permission' => PagePermission::View->value,
        ])
        ->assertForbidden();
});

test('making a page public generates a share slug and url', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $response = $this
        ->actingAs($owner)
        ->patchJson(route('pages.share', $page), [
            'visibility' => PageVisibility::Public->value,
            'permission' => PagePermission::Edit->value,
        ]);

    $slug = $page->fresh()->share_slug;

    expect($slug)->toBeString();
    // Public pages are always view-only regardless of the requested permission.
    expect($page->fresh()->permission)->toBe(PagePermission::View);
    $response->assertJsonPath('shareUrl', route('share.show', $slug));
});

test('a public page is viewable by guests through the share link', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->public()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
        'title' => 'Public board',
        'document' => base64_encode('doc'),
    ]);

    $this->get(route('share.show', $page->share_slug))
        ->assertOk()
        ->assertInertia(fn ($inertia) => $inertia
            ->component('board')
            ->where('boardPage.title', 'Public board')
            ->where('boardPage.document', base64_encode('doc'))
            ->where('boardAccess.isPublic', true)
            ->where('boardAccess.canEdit', false)
            ->missing('boardPage.id'),
        );
});

test('disabling public sharing invalidates the old share link', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->public()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $slug = $page->share_slug;

    $this->actingAs($owner)
        ->patchJson(route('pages.share', $page), [
            'visibility' => PageVisibility::Private->value,
            'permission' => PagePermission::View->value,
        ])
        ->assertOk();

    expect($page->fresh()->share_slug)->toBeNull();

    $this->get(route('share.show', $slug))->assertNotFound();
});

test('an unknown or non-public share slug returns not found', function () {
    $owner = User::factory()->create();

    // Organization-only page has no public slug.
    $page = Page::factory()->sharedWithOrganization()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $this->get(route('share.show', 'does-not-exist'))->assertNotFound();
    expect($page->share_slug)->toBeNull();
});

test('guests cannot reach the authenticated sharing endpoint', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);

    $this->patch(route('pages.share', $page), [
        'visibility' => PageVisibility::Public->value,
        'permission' => PagePermission::View->value,
    ])->assertRedirect(route('login'));

    expect($page->fresh()->visibility)->toBe(PageVisibility::Private);
});
