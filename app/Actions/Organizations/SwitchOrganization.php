<?php

namespace App\Actions\Organizations;

use App\DTOs\Organizations\SwitchOrganizationData;

class SwitchOrganization
{
    public function handle(SwitchOrganizationData $data): bool
    {
        return $data->user->switchOrganization($data->organization);
    }
}
