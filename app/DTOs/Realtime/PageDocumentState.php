<?php

namespace App\DTOs\Realtime;

readonly class PageDocumentState
{
    public function __construct(
        public string $state,
        public int $upToSeq,
    ) {}
}
