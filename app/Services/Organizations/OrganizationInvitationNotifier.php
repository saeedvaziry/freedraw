<?php

namespace App\Services\Organizations;

use App\Models\OrganizationInvitation;
use App\Notifications\Organizations\OrganizationInvitation as OrganizationInvitationNotification;
use Illuminate\Support\Facades\Notification;

class OrganizationInvitationNotifier
{
    public function send(OrganizationInvitation $invitation): void
    {
        Notification::route('mail', $invitation->email)
            ->notify(new OrganizationInvitationNotification($invitation));
    }
}
