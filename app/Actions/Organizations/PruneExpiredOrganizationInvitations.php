<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\PruneExpiredOrganizationInvitationsData;
use App\Models\OrganizationInvitation;

class PruneExpiredOrganizationInvitations
{
    public function handle(PruneExpiredOrganizationInvitationsData $data): int
    {
        return OrganizationInvitation::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->delete();
    }
}
