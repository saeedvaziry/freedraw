<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\UpdateOrganizationMemberData;

class UpdateOrganizationMember
{
    public function handle(UpdateOrganizationMemberData $data): void
    {
        $data->organization->memberships()
            ->where('user_id', $data->member->id)
            ->firstOrFail()
            ->update(['role' => $data->role]);
    }
}
