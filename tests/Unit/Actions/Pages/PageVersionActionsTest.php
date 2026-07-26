<?php

use App\Actions\Pages\CreateNamedSnapshot;
use App\Actions\Pages\RestorePageVersion;
use App\DTOs\Pages\CreateNamedSnapshotData;
use App\DTOs\Pages\RestorePageVersionData;
use App\Models\Page;
use App\Models\PageSnapshot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

test('create named snapshot labels the folded state returned by the realtime service', function () {
    configureRealtimeService();
    Http::fake(['*' => Http::response(['state' => base64_encode('folded-state'), 'upToSeq' => 17])]);

    $user = User::factory()->create();
    $page = Page::factory()->create();

    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 11, 'state' => 'head-state', 'label' => null]);

    $snapshot = app(CreateNamedSnapshot::class)->handle(new CreateNamedSnapshotData(
        page: $page,
        user: $user,
        label: 'Release',
    ));

    expect($snapshot->label)->toBe('Release')
        ->and($snapshot->up_to_seq)->toBe(17)
        ->and($snapshot->state)->toBe('folded-state')
        ->and($snapshot->created_by)->toBe($user->id)
        ->and($page->snapshots()->count())->toBe(2);

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), "/internal/pages/{$page->public_id}/fold"));
});

test('create named snapshot falls back to the stale head state when the realtime service is down', function () {
    configureRealtimeService();
    Http::fake(fn () => throw new ConnectionException('connection refused'));

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
        ->and($page->snapshots()->count())->toBe(3);
});

test('create named snapshot copies the latest head state when no realtime service is configured', function () {
    Http::fake();

    $user = User::factory()->create();
    $page = Page::factory()->create();

    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 2, 'state' => 'old-state', 'label' => null]);
    PageSnapshot::factory()->for($page)->create(['up_to_seq' => 11, 'state' => 'head-state', 'label' => null]);

    $snapshot = app(CreateNamedSnapshot::class)->handle(new CreateNamedSnapshotData(
        page: $page,
        user: $user,
        label: 'Release',
    ));

    expect($snapshot->up_to_seq)->toBe(11)
        ->and($snapshot->state)->toBe('head-state');

    Http::assertNothingSent();
});

test('create named snapshot aborts with 422 when nothing can be folded or copied', function () {
    configureRealtimeService();
    Http::fake(['*' => Http::response(['error' => 'nothing to fold'], 404)]);

    $user = User::factory()->create();
    $page = Page::factory()->create();

    expect(fn () => app(CreateNamedSnapshot::class)->handle(new CreateNamedSnapshotData(
        page: $page,
        user: $user,
        label: 'v1',
    )))->toThrow(HttpException::class, 'no snapshot to label yet');

    expect($page->snapshots()->count())->toBe(0);
});

test('restore page version records the document the realtime service actually applied', function () {
    configureRealtimeService();
    Http::fake(['*' => Http::response(['state' => base64_encode('applied-state'), 'upToSeq' => 31])]);

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

    expect($restored->state)->toBe('applied-state')
        ->and($restored->up_to_seq)->toBe(31)
        ->and($restored->label)->toBe('Restored: v1')
        ->and($restored->created_by)->toBe($user->id)
        ->and($page->snapshots()->count())->toBe(3)
        ->and($version->fresh())->not->toBeNull();

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), "/internal/pages/{$page->public_id}/restore")
        && $request['state'] === base64_encode('v1-state'));
});

test('restore page version aborts with 503 and writes nothing when the live document was not updated', function () {
    configureRealtimeService();
    Http::fake(fn () => throw new ConnectionException('connection refused'));

    $user = User::factory()->create();
    $page = Page::factory()->create();

    $version = PageSnapshot::factory()->for($page)->labelled('v1')->create([
        'up_to_seq' => 4,
        'state' => 'v1-state',
    ]);

    expect(fn () => app(RestorePageVersion::class)->handle(new RestorePageVersionData(
        page: $page,
        user: $user,
        version: $version,
    )))->toThrow(HttpException::class, 'the live document could not be restored, so nothing was changed');

    expect($page->snapshots()->count())->toBe(1);
});

test('restore page version aborts with 503 when no realtime service is configured', function () {
    Http::fake();

    $user = User::factory()->create();
    $page = Page::factory()->create();

    $version = PageSnapshot::factory()->for($page)->labelled('v1')->create(['up_to_seq' => 4]);

    expect(fn () => app(RestorePageVersion::class)->handle(new RestorePageVersionData(
        page: $page,
        user: $user,
        version: $version,
    )))->toThrow(HttpException::class);

    expect($page->snapshots()->count())->toBe(1);
    Http::assertNothingSent();
});

test('restoring a restore does not stack the label prefix', function () {
    configureRealtimeService();
    Http::fake(['*' => Http::response(['state' => base64_encode('applied-state'), 'upToSeq' => 9])]);

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
    configureRealtimeService();
    Http::fake(['*' => Http::response(['state' => base64_encode('applied-state'), 'upToSeq' => 9])]);

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
