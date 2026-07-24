<?php

namespace App\DTOs\Realtime;

use Carbon\CarbonImmutable;

readonly class IssuedRealtimeToken
{
    public function __construct(
        public string $token,
        public CarbonImmutable $expiresAt,
    ) {}
}
