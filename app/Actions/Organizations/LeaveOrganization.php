<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\LeaveOrganizationData;
use App\Models\Organization;

class LeaveOrganization
{
    public function handle(LeaveOrganizationData $data): ?Organization
    {
        $fallbackOrganization = $data->user->isCurrentOrganization($data->organization)
            ? $data->user->fallbackOrganization($data->organization)
            : null;

        $data->organization->memberships()
            ->where('user_id', $data->user->id)
            ->delete();

        if ($fallbackOrganization) {
            $data->user->switchOrganization($fallbackOrganization);
        }

        return $fallbackOrganization;
    }
}
