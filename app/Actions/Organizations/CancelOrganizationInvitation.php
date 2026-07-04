<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\CancelOrganizationInvitationData;

class CancelOrganizationInvitation
{
    public function handle(CancelOrganizationInvitationData $data): void
    {
        abort_unless($data->invitation->organization_id === $data->organization->id, 404);

        $data->invitation->delete();
    }
}
