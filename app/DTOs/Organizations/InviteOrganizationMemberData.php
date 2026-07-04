<?php

namespace App\DTOs\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;

readonly class InviteOrganizationMemberData
{
    public function __construct(
        public User $inviter,
        public Organization $organization,
        public string $email,
        public OrganizationRole $role,
    ) {
        //
    }
}
