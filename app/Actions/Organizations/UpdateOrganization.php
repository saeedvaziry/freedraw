<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\UpdateOrganizationData;
use App\Models\Organization;
use Illuminate\Support\Facades\DB;

class UpdateOrganization
{
    public function handle(UpdateOrganizationData $data): Organization
    {
        return DB::transaction(function () use ($data) {
            $organization = Organization::whereKey($data->organization->id)
                ->lockForUpdate()
                ->firstOrFail();

            $organization->update(['name' => $data->name]);

            return $organization;
        });
    }
}
