<?php

use App\Actions\Pages\UploadPageAsset;
use App\DTOs\Pages\UploadPageAssetData;
use App\Models\Page;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    Storage::fake('assets');
});

test('upload stores the file content-addressed and records its metadata', function () {
    $page = Page::factory()->create();
    $file = UploadedFile::fake()->createWithContent('logo.png', 'the-bytes');
    $hash = hash('sha256', 'the-bytes');

    $asset = app(UploadPageAsset::class)->handle(new UploadPageAssetData(
        page: $page,
        assetId: 'asset-1',
        file: $file,
    ));

    expect($asset->page_id)->toBe($page->id)
        ->and($asset->asset_id)->toBe('asset-1')
        ->and($asset->disk)->toBe('assets')
        ->and($asset->content_hash)->toBe($hash)
        ->and($asset->size)->toBe(strlen('the-bytes'))
        ->and($asset->path)->toBe(sprintf('%s/%s/%s', substr($hash, 0, 2), substr($hash, 2, 2), $hash));

    Storage::disk('assets')->assertExists($asset->path);
    expect(Storage::disk('assets')->get($asset->path))->toBe('the-bytes');
});

test('identical content is written to disk only once', function () {
    $page = Page::factory()->create();

    $first = app(UploadPageAsset::class)->handle(new UploadPageAssetData(
        page: $page,
        assetId: 'asset-1',
        file: UploadedFile::fake()->createWithContent('a.png', 'dupe'),
    ));

    $second = app(UploadPageAsset::class)->handle(new UploadPageAssetData(
        page: $page,
        assetId: 'asset-2',
        file: UploadedFile::fake()->createWithContent('b.png', 'dupe'),
    ));

    expect($second->path)->toBe($first->path)
        ->and(Storage::disk('assets')->allFiles())->toHaveCount(1);
});

test('re-uploading the same asset id replaces the existing record', function () {
    $page = Page::factory()->create();

    $first = app(UploadPageAsset::class)->handle(new UploadPageAssetData(
        page: $page,
        assetId: 'asset-1',
        file: UploadedFile::fake()->createWithContent('a.png', 'old'),
    ));

    $second = app(UploadPageAsset::class)->handle(new UploadPageAssetData(
        page: $page,
        assetId: 'asset-1',
        file: UploadedFile::fake()->createWithContent('a.png', 'new'),
    ));

    expect($second->id)->toBe($first->id)
        ->and($second->content_hash)->toBe(hash('sha256', 'new'))
        ->and($page->assets()->count())->toBe(1);
});
