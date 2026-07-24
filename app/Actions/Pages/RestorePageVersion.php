<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\RestorePageVersionData;
use App\Models\PageSnapshot;

class RestorePageVersion
{
    public function handle(RestorePageVersionData $data): PageSnapshot
    {
        $headSeq = (int) ($data->page->snapshots()->max('up_to_seq') ?? $data->version->up_to_seq);

        return $data->page->snapshots()->create([
            'state' => $data->version->state,
            'up_to_seq' => $headSeq,
            'label' => null,
            'created_by' => $data->user->id,
        ]);
    }
}
