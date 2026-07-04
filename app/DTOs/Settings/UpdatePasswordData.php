<?php

namespace App\DTOs\Settings;

use App\Models\User;

readonly class UpdatePasswordData
{
    public function __construct(
        public User $user,
        public string $password,
    ) {
        //
    }
}
