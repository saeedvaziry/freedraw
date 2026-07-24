<?php

use App\Enums\OrganizationRole;
use App\Enums\PagePermission;
use App\Models\Page;
use App\Models\PageAsset;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

beforeEach(function () {
    Storage::fake('assets');
});

test('members can upload an asset to a page they can edit', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    $assetId = (string) Str::uuid();
    $file = UploadedFile::fake()->image('logo.png', 24, 24);

    $response = $this
        ->actingAs($user)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => $assetId,
            'file' => $file,
        ], ['Accept' => 'application/json']);

    $response
        ->assertCreated()
        ->assertJsonPath('assetId', $assetId)
        ->assertJsonPath('mime', 'image/png')
        ->assertJsonPath('url', route('pages.assets.show', ['page' => $page, 'assetId' => $assetId]));

    $asset = $page->assets()->where('asset_id', $assetId)->firstOrFail();

    expect($response->json())->not->toHaveKey('path')
        ->and($response->json())->not->toHaveKey('disk');

    $this->assertDatabaseHas('page_assets', [
        'page_id' => $page->id,
        'asset_id' => $assetId,
        'disk' => 'assets',
    ]);

    Storage::disk('assets')->assertExists($asset->path);
});

test('re-uploading the same asset id updates the record and returns 200', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    $assetId = (string) Str::uuid();

    $this
        ->actingAs($user)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => $assetId,
            'file' => UploadedFile::fake()->createWithContent('a.png', 'first-bytes'),
        ], ['Accept' => 'application/json'])
        ->assertCreated();

    $this
        ->actingAs($user)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => $assetId,
            'file' => UploadedFile::fake()->createWithContent('a.png', 'second-bytes'),
        ], ['Accept' => 'application/json'])
        ->assertOk();

    expect(PageAsset::where('page_id', $page->id)->where('asset_id', $assetId)->count())->toBe(1)
        ->and($page->assets()->where('asset_id', $assetId)->first()->content_hash)
        ->toBe(hash('sha256', 'second-bytes'));
});

test('identical bytes across assets are stored once', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    foreach (['one', 'two'] as $assetId) {
        $this
            ->actingAs($user)
            ->post(route('pages.assets.store', $page), [
                'asset_id' => $assetId,
                'file' => UploadedFile::fake()->createWithContent("$assetId.png", 'same-bytes'),
            ], ['Accept' => 'application/json'])
            ->assertCreated();
    }

    $paths = $page->assets()->pluck('path')->unique();

    expect($paths)->toHaveCount(1)
        ->and(Storage::disk('assets')->allFiles())->toHaveCount(1);
});

test('members without edit permission cannot upload assets', function () {
    $owner = User::factory()->create();
    $member = User::factory()->create();
    $organization = $owner->currentOrganization;
    $organization->members()->attach($member, ['role' => OrganizationRole::Member->value]);
    $member->switchOrganization($organization);

    $page = Page::factory()->sharedWithOrganization(PagePermission::View)->create([
        'organization_id' => $organization->id,
        'created_by' => $owner->id,
    ]);

    $this
        ->actingAs($member)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => (string) Str::uuid(),
            'file' => UploadedFile::fake()->image('logo.png'),
        ], ['Accept' => 'application/json'])
        ->assertForbidden();

    expect($page->assets()->count())->toBe(0);
});

test('asset uploads are validated', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);

    $this
        ->actingAs($user)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => (string) Str::uuid(),
        ])
        ->assertSessionHasErrors('file');

    $this
        ->actingAs($user)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => (string) Str::uuid(),
            'file' => UploadedFile::fake()->create('notes.txt', 4, 'text/plain'),
        ])
        ->assertSessionHasErrors('file');
});

test('a page viewer can fetch asset bytes', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $user->current_organization_id,
        'created_by' => $user->id,
    ]);
    $assetId = (string) Str::uuid();

    $this
        ->actingAs($user)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => $assetId,
            'file' => UploadedFile::fake()->createWithContent('a.png', 'pixels'),
        ], ['Accept' => 'application/json'])
        ->assertCreated();

    $response = $this
        ->actingAs($user)
        ->get(route('pages.assets.show', ['page' => $page, 'assetId' => $assetId]));

    $response
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png')
        ->assertHeader('X-Content-Type-Options', 'nosniff');

    expect($response->streamedContent())->toBe('pixels');
});

test('users outside the organization cannot fetch assets', function () {
    $owner = User::factory()->create();
    $outsider = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);
    $asset = PageAsset::factory()->for($page)->create();

    $this
        ->actingAs($outsider)
        ->get(route('pages.assets.show', ['page' => $page, 'assetId' => $asset->asset_id]))
        ->assertForbidden();
});

test('public pages serve their assets to anyone', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->public()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
    ]);
    $assetId = (string) Str::uuid();

    $this
        ->actingAs($owner)
        ->post(route('pages.assets.store', $page), [
            'asset_id' => $assetId,
            'file' => UploadedFile::fake()->createWithContent('a.png', 'shared-pixels'),
        ], ['Accept' => 'application/json'])
        ->assertCreated();

    $response = $this->get(route('share.assets.show', ['slug' => $page->share_slug, 'assetId' => $assetId]));

    $response->assertOk()->assertHeader('Content-Type', 'image/png');
    expect($response->streamedContent())->toBe('shared-pixels');
});

test('private pages do not serve assets over the public route', function () {
    $owner = User::factory()->create();
    $page = Page::factory()->create([
        'organization_id' => $owner->current_organization_id,
        'created_by' => $owner->id,
        'share_slug' => 'secretslug',
    ]);
    $asset = PageAsset::factory()->for($page)->create();

    $this
        ->get(route('share.assets.show', ['slug' => 'secretslug', 'assetId' => $asset->asset_id]))
        ->assertNotFound();
});

test('the page_assets table has a referenced_at column', function () {
    expect(Schema::hasColumn('page_assets', 'referenced_at'))->toBeTrue();
});

test('a freshly created asset has a null referenced_at', function () {
    $asset = PageAsset::factory()->create();

    expect($asset->referenced_at)->toBeNull();
});

test('referenced_at is read back as a Carbon instance', function () {
    $asset = PageAsset::factory()->referenced()->create();

    expect($asset->fresh()->referenced_at)->toBeInstanceOf(CarbonInterface::class);
});
