<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\CreateNamedSnapshotData;
use App\DTOs\Realtime\PageDocumentState;
use App\Models\PageSnapshot;
use App\Services\Realtime\HocuspocusDocumentService;

class CreateNamedSnapshot
{
    public function __construct(private readonly HocuspocusDocumentService $documents) {}

    public function handle(CreateNamedSnapshotData $data): PageSnapshot
    {
        $folded = $this->documents->fold($data->page) ?? $this->head($data);

        return $data->page->snapshots()->create([
            'state' => $folded->state,
            'up_to_seq' => $folded->upToSeq,
            'label' => $data->label,
            'created_by' => $data->user->id,
        ]);
    }

    private function head(CreateNamedSnapshotData $data): PageDocumentState
    {
        $head = $data->page->snapshots()
            ->orderByDesc('up_to_seq')
            ->orderByDesc('id')
            ->first();

        abort_unless($head !== null, 422, 'no snapshot to label yet');

        return new PageDocumentState($head->state, $head->up_to_seq);
    }
}
