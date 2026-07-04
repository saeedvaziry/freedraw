<?php

use App\Actions\Pages\CreatePage;
use App\Actions\Pages\DeletePage;
use App\Actions\Pages\UpdatePage;
use App\Actions\Pages\UpdatePageSharing;
use App\DTOs\Pages\CreatePageData;
use App\DTOs\Pages\DeletePageData;
use App\DTOs\Pages\UpdatePageData;
use App\DTOs\Pages\UpdatePageSharingData;
use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Models\Page;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('create page uses the current organization and normalizes blank titles', function () {
    $user = User::factory()->create();

    $page = app(CreatePage::class)->handle(new CreatePageData(
        user: $user,
        title: '  ',
        document: 'document',
    ));

    expect($page->organization_id)->toBe($user->current_organization_id)
        ->and($page->created_by)->toBe($user->id)
        ->and($page->title)->toBe('Untitled page')
        ->and($page->document)->toBe('document');
});

test('update page applies only submitted fields', function () {
    $page = Page::factory()->create(['title' => 'Old', 'document' => 'old']);

    $updated = app(UpdatePage::class)->handle(new UpdatePageData(
        page: $page,
        title: 'New',
        document: null,
        hasTitle: true,
        hasDocument: false,
    ));

    expect($updated->title)->toBe('New')
        ->and($updated->document)->toBe('old');
});

test('delete page returns the next visible page route', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create(['organization_id' => $user->current_organization_id, 'created_by' => $user->id]);
    $nextPage = Page::factory()->create(['organization_id' => $user->current_organization_id, 'created_by' => $user->id]);

    $redirectUrl = app(DeletePage::class)->handle(new DeletePageData($user, $page));

    expect($redirectUrl)->toBe(route('pages.show', $nextPage));
});

test('update page sharing forces public pages to view permission', function () {
    $page = Page::factory()->create();

    $updated = app(UpdatePageSharing::class)->handle(new UpdatePageSharingData(
        page: $page,
        visibility: PageVisibility::Public,
        permission: PagePermission::Edit,
    ));

    expect($updated->visibility)->toBe(PageVisibility::Public)
        ->and($updated->permission)->toBe(PagePermission::View)
        ->and($updated->share_slug)->not->toBeNull();
});
