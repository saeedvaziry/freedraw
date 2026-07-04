<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\InviteOrganizationMemberData;
use App\Models\OrganizationInvitation;
use App\Services\Organizations\OrganizationInvitationNotifier;

class InviteOrganizationMember
{
    public function __construct(private OrganizationInvitationNotifier $notifier)
    {
        //
    }

    public function handle(InviteOrganizationMemberData $data): OrganizationInvitation
    {
        $invitation = $data->organization->invitations()->create([
            'email' => $data->email,
            'role' => $data->role,
            'invited_by' => $data->inviter->id,
            'expires_at' => now()->addDays(3),
        ]);

        $this->notifier->send($invitation);

        return $invitation;
    }
}
