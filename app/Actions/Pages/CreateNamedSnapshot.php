<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\CreateNamedSnapshotData;
use App\Models\PageSnapshot;

class CreateNamedSnapshot
{
    public function handle(CreateNamedSnapshotData $data): PageSnapshot
    {
        $head = $data->page->snapshots()
            ->orderByDesc('up_to_seq')
            ->orderByDesc('id')
            ->first();

        abort_unless($head !== null, 422, 'no snapshot to label yet');

        return $data->page->snapshots()->create([
            'state' => $head->state,
            'up_to_seq' => $head->up_to_seq,
            'label' => $data->label,
            'created_by' => $data->user->id,
        ]);
    }
}
