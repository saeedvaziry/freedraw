<?php

use App\Actions\Realtime\IssueRealtimeToken;
use App\DTOs\Realtime\IssueRealtimeTokenData;

if (! function_exists('decodeRealtimeTokenPayload')) {
    function decodeRealtimeTokenPayload(string $token): array
    {
        [$encoded] = explode('.', $token);

        return json_decode(base64_decode(strtr($encoded, '-_', '+/')), true);
    }
}

test('it mints a signed token carrying the expected claims', function () {
    config()->set('services.collab.secret', 'unit-secret');
    config()->set('services.collab.token_ttl', 60);

    $issued = app(IssueRealtimeToken::class)->handle(new IssueRealtimeTokenData(
        room: 'room-123',
        uid: 7,
        canEdit: true,
    ));

    expect($issued->token)->toBeString()
        ->and(substr_count($issued->token, '.'))->toBe(1);

    $payload = decodeRealtimeTokenPayload($issued->token);

    expect($payload['room'])->toBe('room-123')
        ->and($payload['uid'])->toBe(7)
        ->and($payload['canEdit'])->toBeTrue()
        ->and($payload['exp'])->toBe($issued->expiresAt->getTimestamp())
        ->and($issued->expiresAt->getTimestamp())->toBeGreaterThan(now()->getTimestamp());
});

test('it signs the payload with a verifiable hmac signature', function () {
    config()->set('services.collab.secret', 'unit-secret');

    $issued = app(IssueRealtimeToken::class)->handle(new IssueRealtimeTokenData(
        room: 'room-9',
        uid: null,
        canEdit: false,
    ));

    [$encodedPayload, $encodedSignature] = explode('.', $issued->token);

    $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $encodedPayload, 'unit-secret', true)), '+/', '-_'), '=');

    expect(hash_equals($expected, $encodedSignature))->toBeTrue();

    $payload = decodeRealtimeTokenPayload($issued->token);
    expect($payload['uid'])->toBeNull()
        ->and($payload['canEdit'])->toBeFalse();
});

test('it refuses to mint a token when the secret is not configured', function () {
    config()->set('services.collab.secret', null);

    app(IssueRealtimeToken::class)->handle(new IssueRealtimeTokenData(
        room: 'room-1',
        uid: null,
        canEdit: false,
    ));
})->throws(RuntimeException::class);
