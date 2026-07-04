<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\UpdatePageSharingData;
use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Models\Page;

class UpdatePageSharing
{
    public function handle(UpdatePageSharingData $data): Page
    {
        $permission = $data->visibility === PageVisibility::Organization
            ? $data->permission
            : PagePermission::View;

        $data->page->visibility = $data->visibility;
        $data->page->permission = $permission;

        if ($data->visibility === PageVisibility::Public) {
            $data->page->enablePublicSharing();
        } else {
            $data->page->disablePublicSharing();
        }

        $data->page->save();

        return $data->page->refresh();
    }
}
