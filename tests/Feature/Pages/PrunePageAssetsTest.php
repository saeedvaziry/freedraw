<?php

use App\Models\PageAsset;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('assets');
});

test('the prune command deletes orphaned assets and keeps referenced ones', function () {
    $orphan = PageAsset::factory()->create([
        'referenced_at' => now()->subDays(8),
    ]);
    Storage::disk('assets')->put($orphan->path, 'bytes');

    $referenced = PageAsset::factory()->referenced()->create();
    Storage::disk('assets')->put($referenced->path, 'bytes');

    $this->artisan('assets:prune')->assertSuccessful();

    $this->assertDatabaseMissing('page_assets', ['id' => $orphan->id]);
    $this->assertDatabaseHas('page_assets', ['id' => $referenced->id]);

    Storage::disk('assets')->assertMissing($orphan->path);
    Storage::disk('assets')->assertExists($referenced->path);
});

test('the prune command respects a custom older-than window', function () {
    $asset = PageAsset::factory()->create([
        'referenced_at' => now()->subDays(3),
    ]);
    Storage::disk('assets')->put($asset->path, 'bytes');

    $this->artisan('assets:prune')->assertSuccessful();
    $this->assertDatabaseHas('page_assets', ['id' => $asset->id]);

    $this->artisan('assets:prune', ['--older-than' => 1])->assertSuccessful();
    $this->assertDatabaseMissing('page_assets', ['id' => $asset->id]);
    Storage::disk('assets')->assertMissing($asset->path);
});
