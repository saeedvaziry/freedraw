<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\RespondToOrganizationInvitationData;
use Illuminate\Support\Facades\DB;

class AcceptOrganizationInvitation
{
    public function handle(RespondToOrganizationInvitationData $data): void
    {
        DB::transaction(function () use ($data) {
            $organization = $data->invitation->organization;

            $organization->memberships()->firstOrCreate(
                ['user_id' => $data->user->id],
                ['role' => $data->invitation->role],
            );

            $data->invitation->update(['accepted_at' => now()]);

            $data->user->switchOrganization($organization);
        });
    }
}
