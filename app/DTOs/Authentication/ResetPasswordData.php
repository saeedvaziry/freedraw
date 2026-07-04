<?php

namespace App\DTOs\Authentication;

use App\Models\User;

readonly class ResetPasswordData
{
    public function __construct(
        public User $user,
        public string $password,
    ) {
        //
    }
}
