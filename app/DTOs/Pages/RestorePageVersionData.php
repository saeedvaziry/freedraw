<?php

namespace App\DTOs\Pages;

use App\Models\Page;
use App\Models\PageSnapshot;
use App\Models\User;

readonly class RestorePageVersionData
{
    public function __construct(
        public Page $page,
        public User $user,
        public PageSnapshot $version,
    ) {}
}
