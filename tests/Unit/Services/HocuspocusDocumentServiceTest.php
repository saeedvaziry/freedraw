<?php

use App\DTOs\Realtime\PageDocumentState;
use App\Models\Page;
use App\Services\Realtime\HocuspocusDocumentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

test('hocuspocus document service is unconfigured until both the url and secret are set', function () {
    $service = app(HocuspocusDocumentService::class);

    expect($service->isConfigured())->toBeFalse();

    config()->set('services.collab.internal_url', 'http://hocuspocus.test:1234');

    expect($service->isConfigured())->toBeFalse();

    config()->set('services.collab.internal_secret', 'internal-secret');

    expect($service->isConfigured())->toBeTrue();
});

test('hocuspocus document service sends nothing when it is not configured', function () {
    Http::fake();

    $page = Page::factory()->create();
    $service = app(HocuspocusDocumentService::class);

    expect($service->fold($page))->toBeNull()
        ->and($service->restore($page, 'state'))->toBeNull();

    Http::assertNothingSent();
});

test('hocuspocus document service folds the head through the internal endpoint', function () {
    configureRealtimeService('http://hocuspocus.test:1234/');
    Http::fake([
        '*' => Http::response(['state' => base64_encode('folded-state'), 'upToSeq' => 42]),
    ]);

    $page = Page::factory()->create();

    $folded = app(HocuspocusDocumentService::class)->fold($page);

    expect($folded)->toBeInstanceOf(PageDocumentState::class)
        ->and($folded->state)->toBe('folded-state')
        ->and($folded->upToSeq)->toBe(42);

    Http::assertSent(fn (Request $request) => $request->url() === "http://hocuspocus.test:1234/internal/pages/{$page->public_id}/fold"
        && $request->method() === 'POST'
        && $request->hasHeader('Authorization', 'Bearer internal-secret'));
});

test('hocuspocus document service returns null when the service reports nothing to fold', function () {
    configureRealtimeService();
    Http::fake(['*' => Http::response(['error' => 'nothing to fold'], 404)]);

    expect(app(HocuspocusDocumentService::class)->fold(Page::factory()->create()))->toBeNull();
});

test('hocuspocus document service returns null when the service is unreachable', function () {
    configureRealtimeService();
    Http::fake(fn () => throw new ConnectionException('connection refused'));

    $page = Page::factory()->create();
    $service = app(HocuspocusDocumentService::class);

    expect($service->fold($page))->toBeNull()
        ->and($service->restore($page, 'state'))->toBeNull();
});

test('hocuspocus document service posts the version state and decodes the applied document', function () {
    configureRealtimeService();
    Http::fake([
        '*' => Http::response(['state' => base64_encode('applied-state'), 'upToSeq' => '7']),
    ]);

    $page = Page::factory()->create();

    $restored = app(HocuspocusDocumentService::class)->restore($page, "\x01\x02version");

    expect($restored->state)->toBe('applied-state')
        ->and($restored->upToSeq)->toBe(7);

    Http::assertSent(fn (Request $request) => $request->url() === "http://hocuspocus.test:1234/internal/pages/{$page->public_id}/restore"
        && $request['state'] === base64_encode("\x01\x02version"));
});

test('hocuspocus document service returns null for an unusable response payload', function () {
    configureRealtimeService();

    $page = Page::factory()->create();
    $service = app(HocuspocusDocumentService::class);

    Http::fake(['*' => Http::response(['state' => '***', 'upToSeq' => 3])]);
    expect($service->restore($page, 'state'))->toBeNull();

    Http::fake(['*' => Http::response(['state' => base64_encode('ok')])]);
    expect($service->restore($page, 'state'))->toBeNull();

    Http::fake(['*' => Http::response(['upToSeq' => 3])]);
    expect($service->restore($page, 'state'))->toBeNull();
});
