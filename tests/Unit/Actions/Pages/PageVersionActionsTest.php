<?php

use App\Actions\Pages\CreateNamedSnapshot;
use App\Actions\Pages\RestorePageVersion;
use App\DTOs\Pages\CreateNamedSnapshotData;
use App\DTOs\Pages\RestorePageVersionData;
use App\Models\Page;
use App\Models\PageSnapshot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

test('create named snapshot copies the latest head state and seq', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create();

    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 2, 'state' => 'old-state', 'label' => null]);
    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 11, 'state' => 'head-state', 'label' => null]);

    $snapshot = app(CreateNamedSnapshot::class)->handle(new CreateNamedSnapshotData(
        page: $page,
        user: $user,
        label: 'Release',
    ));

    expect($snapshot->label)->toBe('Release')
        ->and($snapshot->up_to_seq)->toBe(11)
        ->and($snapshot->state)->toBe('head-state')
        ->and($snapshot->created_by)->toBe($user->id)
        ->and($page->snapshots()->count())->toBe(3);
});

test('create named snapshot aborts with 422 when the page has no snapshot', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create();

    expect(fn () => app(CreateNamedSnapshot::class)->handle(new CreateNamedSnapshotData(
        page: $page,
        user: $user,
        label: 'v1',
    )))->toThrow(HttpException::class, 'no snapshot to label yet');

    expect($page->snapshots()->count())->toBe(0);
});

test('restore page version appends a new head-seq row and never deletes', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create();

    $version = PageSnapshot::factory()->for($page)->labelled('v1')->create([
        'up_to_seq' => 4,
        'state' => 'v1-state',
    ]);
    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 25, 'state' => 'head-state', 'label' => null]);

    $restored = app(RestorePageVersion::class)->handle(new RestorePageVersionData(
        page: $page,
        user: $user,
        version: $version,
    ));

    expect($restored->state)->toBe('v1-state')
        ->and($restored->up_to_seq)->toBe(25)
        ->and($restored->label)->toBe('Restored: v1')
        ->and($restored->created_by)->toBe($user->id)
        ->and($page->snapshots()->count())->toBe(3)
        ->and($version->fresh())->not->toBeNull();
});

test('restoring a restore does not stack the label prefix', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create();

    $version = PageSnapshot::factory()->for($page)->labelled('Restored: v1')->create([
        'up_to_seq' => 4,
        'state' => 'v1-state',
    ]);

    $restored = app(RestorePageVersion::class)->handle(new RestorePageVersionData(
        page: $page,
        user: $user,
        version: $version,
    ));

    expect($restored->label)->toBe('Restored: v1');
});

test('restore labels stay within the column limit', function () {
    $user = User::factory()->create();
    $page = Page::factory()->create();

    $version = PageSnapshot::factory()->for($page)->labelled(str_repeat('a', 255))->create([
        'up_to_seq' => 4,
        'state' => 'v1-state',
    ]);

    $restored = app(RestorePageVersion::class)->handle(new RestorePageVersionData(
        page: $page,
        user: $user,
        version: $version,
    ));

    expect(mb_strlen($restored->label))->toBe(255)
        ->and($restored->label)->toStartWith('Restored: ');
});
