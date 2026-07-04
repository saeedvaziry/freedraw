<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\DeleteOrganizationData;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DeleteOrganization
{
    public function handle(DeleteOrganizationData $data): ?Organization
    {
        $fallbackOrganization = $data->user->isCurrentOrganization($data->organization)
            ? $data->user->fallbackOrganization($data->organization)
            : null;

        DB::transaction(function () use ($data) {
            User::where('current_organization_id', $data->organization->id)
                ->where('id', '!=', $data->user->id)
                ->each(fn (User $affectedUser) => $affectedUser->switchOrganization($affectedUser->personalOrganization()));

            $data->organization->invitations()->delete();
            $data->organization->memberships()->delete();
            $data->organization->delete();
        });

        if ($fallbackOrganization) {
            $data->user->switchOrganization($fallbackOrganization);
        }

        return $fallbackOrganization;
    }
}
