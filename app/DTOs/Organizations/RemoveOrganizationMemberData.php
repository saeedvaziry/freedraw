<?php

namespace App\DTOs\Organizations;

use App\Models\Organization;
use App\Models\User;

readonly class RemoveOrganizationMemberData
{
    public function __construct(
        public Organization $organization,
        public User $member,
    ) {
        //
    }
}
