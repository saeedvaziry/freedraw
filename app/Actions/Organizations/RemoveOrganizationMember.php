<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\RemoveOrganizationMemberData;

class RemoveOrganizationMember
{
    public function handle(RemoveOrganizationMemberData $data): void
    {
        abort_if($data->organization->owner()?->is($data->member), 403, __('The organization owner cannot be removed.'));

        $data->organization->memberships()
            ->where('user_id', $data->member->id)
            ->delete();

        if ($data->member->isCurrentOrganization($data->organization)) {
            $data->member->switchOrganization($data->member->personalOrganization());
        }
    }
}
