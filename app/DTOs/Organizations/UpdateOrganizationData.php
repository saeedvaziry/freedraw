<?php

namespace App\DTOs\Organizations;

use App\Models\Organization;

readonly class UpdateOrganizationData
{
    public function __construct(
        public Organization $organization,
        public string $name,
    ) {
        //
    }
}
