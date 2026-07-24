<?php

namespace App\Actions\Realtime;

use App\DTOs\Realtime\IssuedRealtimeToken;
use App\DTOs\Realtime\IssueRealtimeTokenData;
use Carbon\CarbonImmutable;
use RuntimeException;

class IssueRealtimeToken
{
    public function handle(IssueRealtimeTokenData $data): IssuedRealtimeToken
    {
        $secret = (string) config('services.collab.secret');

        if ($secret === '') {
            throw new RuntimeException('The realtime collaboration secret is not configured.');
        }

        $ttl = max(1, (int) config('services.collab.token_ttl', 60));
        $expiresAt = CarbonImmutable::now()->addSeconds($ttl);

        $payload = [
            'room' => $data->room,
            'uid' => $data->uid,
            'canEdit' => $data->canEdit,
            'exp' => $expiresAt->getTimestamp(),
        ];

        $encodedPayload = $this->base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $encodedPayload, $secret, true);
        $token = $encodedPayload.'.'.$this->base64UrlEncode($signature);

        return new IssuedRealtimeToken($token, $expiresAt);
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
