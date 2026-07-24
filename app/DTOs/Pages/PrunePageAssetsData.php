<?php

namespace App\DTOs\Pages;

readonly class PrunePageAssetsData
{
    public function __construct(
        public int $olderThanDays = 7,
    ) {}
}
