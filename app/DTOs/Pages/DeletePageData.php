<?php

namespace App\DTOs\Pages;

use App\Models\Page;
use App\Models\User;

readonly class DeletePageData
{
    public function __construct(
        public User $user,
        public Page $page,
    ) {
        //
    }
}
