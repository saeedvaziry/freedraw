<?php

namespace App\DTOs\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;

readonly class UpdateOrganizationMemberData
{
    public function __construct(
        public Organization $organization,
        public User $member,
        public OrganizationRole $role,
    ) {
        //
    }
}
