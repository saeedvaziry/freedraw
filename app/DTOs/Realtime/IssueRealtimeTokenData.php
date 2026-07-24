<?php

namespace App\DTOs\Realtime;

readonly class IssueRealtimeTokenData
{
    public function __construct(
        public string $room,
        public ?int $uid,
        public bool $canEdit,
    ) {}
}
