<?php

namespace App\Console\Commands;

use App\Actions\Organizations\PruneExpiredOrganizationInvitations as PruneExpiredOrganizationInvitationsAction;
use App\DTOs\Organizations\PruneExpiredOrganizationInvitationsData;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('organizations:prune-expired-invitations')]
#[Description('Delete expired organization invitations.')]
class PruneExpiredOrganizationInvitations extends Command
{
    public function handle(PruneExpiredOrganizationInvitationsAction $pruneExpiredOrganizationInvitations): int
    {
        $deleted = $pruneExpiredOrganizationInvitations->handle(new PruneExpiredOrganizationInvitationsData);

        $this->components->info(__('Deleted :count expired organization invitations.', ['count' => $deleted]));

        return self::SUCCESS;
    }
}
