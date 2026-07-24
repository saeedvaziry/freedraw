<?php

namespace App\DTOs\Pages;

use App\Models\Page;
use App\Models\User;

readonly class CreateNamedSnapshotData
{
    public function __construct(
        public Page $page,
        public User $user,
        public string $label,
    ) {}
}
