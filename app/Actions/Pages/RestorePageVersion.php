<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\RestorePageVersionData;
use App\Models\PageSnapshot;
use Illuminate\Support\Str;

class RestorePageVersion
{
    private const LABEL_PREFIX = 'Restored: ';

    private const LABEL_LIMIT = 255;

    public function handle(RestorePageVersionData $data): PageSnapshot
    {
        $headSeq = (int) ($data->page->snapshots()->max('up_to_seq') ?? $data->version->up_to_seq);

        return $data->page->snapshots()->create([
            'state' => $data->version->state,
            'up_to_seq' => $headSeq,
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
