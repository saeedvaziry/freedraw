<?php

use App\Models\Page;
use App\Models\PageSnapshot;
use App\Models\PageUpdate;
use App\Models\User;
use Illuminate\Database\QueryException;

test('a page has many update-log entries and preserves the update payload', function () {
    $page = Page::factory()->create();

    $update = PageUpdate::factory()->for($page)->create([
        'seq' => 1,
        'update' => "\x01\x02\xff\x10payload",
        'origin' => 'client-a',
    ]);

    expect($page->updates()->count())->toBe(1)
        ->and($update->fresh()->update)->toBe("\x01\x02\xff\x10payload")
        ->and($update->page->is($page))->toBeTrue()
        ->and($update->created_at)->not->toBeNull();
});

test('update-log entries do not track an updated_at column', function () {
    expect(PageUpdate::UPDATED_AT)->toBeNull();

    $update = PageUpdate::factory()->create();

    expect($update->getAttributes())->not->toHaveKey('updated_at');
});

test('seq is unique per page in the update log', function () {
    $page = Page::factory()->create();

    PageUpdate::factory()->for($page)->create(['seq' => 5]);

    expect(fn () => PageUpdate::factory()->for($page)->create(['seq' => 5]))
        ->toThrow(QueryException::class);
});

test('the same seq may exist across different pages', function () {
    $first = Page::factory()->create();
    $second = Page::factory()->create();

    PageUpdate::factory()->for($first)->create(['seq' => 1]);
    PageUpdate::factory()->for($second)->create(['seq' => 1]);

    expect(PageUpdate::where('seq', 1)->count())->toBe(2);
});

test('a page has many compaction snapshots with a creator and label', function () {
    $creator = User::factory()->create();
    $page = Page::factory()->create();

    $snapshot = PageSnapshot::factory()
        ->for($page)
        ->labelled('v1')
        ->create([
            'up_to_seq' => 42,
            'state' => "\x01\x02\xff\x10state",
            'created_by' => $creator->id,
        ]);

    expect($page->snapshots()->count())->toBe(1)
        ->and($snapshot->up_to_seq)->toBe(42)
        ->and($snapshot->label)->toBe('v1')
        ->and($snapshot->fresh()->state)->toBe("\x01\x02\xff\x10state")
        ->and($snapshot->creator->is($creator))->toBeTrue();
});

test('deleting a page cascades to its update log and snapshots', function () {
    $page = Page::factory()->create();
    PageUpdate::factory()->for($page)->create(['seq' => 1]);
    PageSnapshot::factory()->for($page)->create();

    $page->delete();

    expect(PageUpdate::count())->toBe(0)
        ->and(PageSnapshot::count())->toBe(0);
});
