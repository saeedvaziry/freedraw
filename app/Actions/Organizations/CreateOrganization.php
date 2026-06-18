<?php

namespace App\Actions\Organizations;

use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreateOrganization
{
    /**
     * Create a new organization and add the user as owner.
     */
    public function handle(User $user, string $name, bool $isPersonal = false): Organization
    {
        return DB::transaction(function () use ($user, $name, $isPersonal) {
            $organization = Organization::create([
                'name' => $name,
                'is_personal' => $isPersonal,
            ]);

            $membership = $organization->memberships()->create([
                'user_id' => $user->id,
                'role' => OrganizationRole::Owner,
            ]);

            $user->switchOrganization($organization);

            return $organization;
        });
    }
}
