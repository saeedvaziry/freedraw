<?php

namespace App\DTOs\Pages;

use App\Models\Page;

readonly class UpdatePageData
{
    public function __construct(
        public Page $page,
        public ?string $title,
        public ?string $document,
        public bool $hasTitle,
        public bool $hasDocument,
    ) {
        //
    }
}
