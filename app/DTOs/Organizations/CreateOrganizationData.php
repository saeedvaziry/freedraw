<?php

namespace App\DTOs\Organizations;

use App\Models\User;

readonly class CreateOrganizationData
{
    public function __construct(
        public User $user,
        public string $name,
        public bool $isPersonal = false,
    ) {
        //
    }
}
