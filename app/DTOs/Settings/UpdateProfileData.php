<?php

namespace App\DTOs\Settings;

use App\Models\User;

readonly class UpdateProfileData
{
    public function __construct(
        public User $user,
        public string $name,
        public string $email,
    ) {
        //
    }
}
