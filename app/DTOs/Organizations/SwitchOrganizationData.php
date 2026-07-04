<?php

namespace App\DTOs\Organizations;

use App\Models\Organization;
use App\Models\User;

readonly class SwitchOrganizationData
{
    public function __construct(
        public User $user,
        public Organization $organization,
    ) {
        //
    }
}
