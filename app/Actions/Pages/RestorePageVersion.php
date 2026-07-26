<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\RestorePageVersionData;
use App\Models\PageSnapshot;
use App\Services\Realtime\HocuspocusDocumentService;
use Illuminate\Support\Str;

class RestorePageVersion
{
    private const LABEL_PREFIX = 'Restored: ';

    private const LABEL_LIMIT = 255;

    public function __construct(private readonly HocuspocusDocumentService $documents) {}

    public function handle(RestorePageVersionData $data): PageSnapshot
    {
        $restored = $this->documents->restore($data->page, $data->version->state);

        if ($restored === null) {
            abort(503, 'the live document could not be restored, so nothing was changed');
        }

        return $data->page->snapshots()->create([
            'state' => $restored->state,
            'up_to_seq' => $restored->upToSeq,
            'label' => $this->label($data->version),
            'created_by' => $data->user->id,
        ]);
    }

    private function label(PageSnapshot $version): string
    {
        $source = $version->label ?? '';
        $base = Str::startsWith($source, self::LABEL_PREFIX)
            ? Str::after($source, self::LABEL_PREFIX)
            : $source;

        return Str::limit(self::LABEL_PREFIX.$base, self::LABEL_LIMIT, '');
    }
}
