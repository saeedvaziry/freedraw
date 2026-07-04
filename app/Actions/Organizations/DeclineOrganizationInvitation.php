<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\RespondToOrganizationInvitationData;

class DeclineOrganizationInvitation
{
    public function handle(RespondToOrganizationInvitationData $data): void
    {
        $data->invitation->delete();
    }
}
