<?php

namespace App\DTOs\Organizations;

use App\Models\Organization;
use App\Models\User;

readonly class LeaveOrganizationData
{
    public function __construct(
        public User $user,
        public Organization $organization,
    ) {
        //
    }
}
