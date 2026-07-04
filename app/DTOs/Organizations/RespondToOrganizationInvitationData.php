<?php

namespace App\DTOs\Organizations;

use App\Models\OrganizationInvitation;
use App\Models\User;

readonly class RespondToOrganizationInvitationData
{
    public function __construct(
        public User $user,
        public OrganizationInvitation $invitation,
    ) {
        //
    }
}
