<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\CreateOrganizationData;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use Illuminate\Support\Facades\DB;

class CreateOrganization
{
    /**
     * Create a new organization and add the user as owner.
     */
    public function handle(CreateOrganizationData $data): Organization
    {
        return DB::transaction(function () use ($data) {
            $organization = Organization::create([
                'name' => $data->name,
                'is_personal' => $data->isPersonal,
            ]);

            $organization->memberships()->create([
                'user_id' => $data->user->id,
                'role' => OrganizationRole::Owner,
            ]);

            $data->user->switchOrganization($organization);

            return $organization;
        });
    }
}
