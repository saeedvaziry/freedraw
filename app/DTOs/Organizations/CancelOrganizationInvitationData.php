<?php

namespace App\DTOs\Organizations;

use App\Models\Organization;
use App\Models\OrganizationInvitation;

readonly class CancelOrganizationInvitationData
{
    public function __construct(
        public Organization $organization,
        public OrganizationInvitation $invitation,
    ) {
        //
    }
}
