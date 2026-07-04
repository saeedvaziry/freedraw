<?php

namespace App\DTOs\Pages;

use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Models\Page;

readonly class UpdatePageSharingData
{
    public function __construct(
        public Page $page,
        public PageVisibility $visibility,
        public PagePermission $permission,
    ) {
        //
    }
}
