<?php

namespace App\DTOs\Pages;

use App\Models\User;

readonly class CreatePageData
{
    public function __construct(
        public User $user,
        public ?string $title,
        public ?string $document,
    ) {
        //
    }
}
