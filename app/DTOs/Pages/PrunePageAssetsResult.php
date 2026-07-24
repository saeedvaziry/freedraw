<?php

namespace App\DTOs\Pages;

readonly class PrunePageAssetsResult
{
    public function __construct(
        public int $rowsDeleted,
        public int $filesDeleted,
        public int $filesKept,
    ) {}
}
