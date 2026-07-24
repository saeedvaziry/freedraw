<?php

use App\Actions\Pages\PrunePageAssets;
use App\DTOs\Pages\PrunePageAssetsData;
use App\Models\PageAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('assets');
});

function sharedAssetPath(string $seed): array
{
    $hash = hash('sha256', $seed);

    return [
        'content_hash' => $hash,
        'path' => sprintf('%s/%s/%s', substr($hash, 0, 2), substr($hash, 2, 2), $hash),
    ];
}

test('a fresh upload with a null referenced_at and recent created_at is not pruned', function () {
    $asset = PageAsset::factory()->create([
        'referenced_at' => null,
        'created_at' => now(),
    ]);
    Storage::disk('assets')->put($asset->path, 'bytes');

    $result = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($result->rowsDeleted)->toBe(0)
        ->and($result->filesDeleted)->toBe(0)
        ->and($result->filesKept)->toBe(0);

    $this->assertDatabaseHas('page_assets', ['id' => $asset->id]);
    Storage::disk('assets')->assertExists($asset->path);
});

test('a recently referenced asset is not pruned', function () {
    $asset = PageAsset::factory()->referenced()->create();
    Storage::disk('assets')->put($asset->path, 'bytes');

    $result = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($result->rowsDeleted)->toBe(0);
    $this->assertDatabaseHas('page_assets', ['id' => $asset->id]);
    Storage::disk('assets')->assertExists($asset->path);
});

test('an orphan with a stale referenced_at is pruned and its file deleted', function () {
    $asset = PageAsset::factory()->create([
        'referenced_at' => now()->subDays(8),
    ]);
    Storage::disk('assets')->put($asset->path, 'bytes');

    $result = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($result->rowsDeleted)->toBe(1)
        ->and($result->filesDeleted)->toBe(1)
        ->and($result->filesKept)->toBe(0);

    $this->assertDatabaseMissing('page_assets', ['id' => $asset->id]);
    Storage::disk('assets')->assertMissing($asset->path);
});

test('an orphan with a null referenced_at and old created_at is pruned', function () {
    $asset = PageAsset::factory()->create([
        'referenced_at' => null,
        'created_at' => now()->subDays(10),
    ]);
    Storage::disk('assets')->put($asset->path, 'bytes');

    $result = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($result->rowsDeleted)->toBe(1)
        ->and($result->filesDeleted)->toBe(1);

    $this->assertDatabaseMissing('page_assets', ['id' => $asset->id]);
    Storage::disk('assets')->assertMissing($asset->path);
});

test('a shared file is kept when a surviving row still references it', function () {
    $shared = sharedAssetPath('shared-kept');

    $orphan = PageAsset::factory()->create([
        ...$shared,
        'referenced_at' => now()->subDays(8),
    ]);
    $active = PageAsset::factory()->referenced()->create($shared);

    Storage::disk('assets')->put($shared['path'], 'bytes');

    $result = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($result->rowsDeleted)->toBe(1)
        ->and($result->filesDeleted)->toBe(0)
        ->and($result->filesKept)->toBe(1);

    $this->assertDatabaseMissing('page_assets', ['id' => $orphan->id]);
    $this->assertDatabaseHas('page_assets', ['id' => $active->id]);
    Storage::disk('assets')->assertExists($shared['path']);
});

test('two orphans sharing a file delete both rows and the file once', function () {
    $shared = sharedAssetPath('shared-both-orphaned');

    $first = PageAsset::factory()->create([
        ...$shared,
        'referenced_at' => now()->subDays(8),
    ]);
    $second = PageAsset::factory()->create([
        ...$shared,
        'referenced_at' => now()->subDays(9),
    ]);

    Storage::disk('assets')->put($shared['path'], 'bytes');

    $result = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($result->rowsDeleted)->toBe(2)
        ->and($result->filesDeleted)->toBe(1)
        ->and($result->filesKept)->toBe(0);

    $this->assertDatabaseMissing('page_assets', ['id' => $first->id]);
    $this->assertDatabaseMissing('page_assets', ['id' => $second->id]);
    Storage::disk('assets')->assertMissing($shared['path']);
});

test('the grace window is configurable via the older-than option', function () {
    $asset = PageAsset::factory()->create([
        'referenced_at' => now()->subDays(2),
    ]);
    Storage::disk('assets')->put($asset->path, 'bytes');

    $survives = app(PrunePageAssets::class)->handle(new PrunePageAssetsData(olderThanDays: 7));
    expect($survives->rowsDeleted)->toBe(0);
    $this->assertDatabaseHas('page_assets', ['id' => $asset->id]);

    $pruned = app(PrunePageAssets::class)->handle(new PrunePageAssetsData(olderThanDays: 1));
    expect($pruned->rowsDeleted)->toBe(1);
    $this->assertDatabaseMissing('page_assets', ['id' => $asset->id]);
    Storage::disk('assets')->assertMissing($asset->path);
});

test('a missing physical file does not raise an error', function () {
    $asset = PageAsset::factory()->create([
        'referenced_at' => now()->subDays(8),
    ]);

    $result = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($result->rowsDeleted)->toBe(1)
        ->and($result->filesDeleted)->toBe(0);

    $this->assertDatabaseMissing('page_assets', ['id' => $asset->id]);
});

test('running the prune twice is idempotent', function () {
    $asset = PageAsset::factory()->create([
        'referenced_at' => now()->subDays(8),
    ]);
    Storage::disk('assets')->put($asset->path, 'bytes');

    app(PrunePageAssets::class)->handle(new PrunePageAssetsData);
    $second = app(PrunePageAssets::class)->handle(new PrunePageAssetsData);

    expect($second->rowsDeleted)->toBe(0)
        ->and($second->filesDeleted)->toBe(0)
        ->and($second->filesKept)->toBe(0);
});
