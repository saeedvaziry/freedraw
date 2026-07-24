<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\PrunePageAssetsData;
use App\DTOs\Pages\PrunePageAssetsResult;
use App\Models\PageAsset;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class PrunePageAssets
{
    public function handle(PrunePageAssetsData $data): PrunePageAssetsResult
    {
        $threshold = now()->subDays($data->olderThanDays);

        /** @var Collection<int, PageAsset> $orphans */
        $orphans = PageAsset::query()
            ->whereRaw('COALESCE(referenced_at, created_at) < ?', [$threshold])
            ->get();

        if ($orphans->isEmpty()) {
            return new PrunePageAssetsResult(rowsDeleted: 0, filesDeleted: 0, filesKept: 0);
        }

        $filesToDelete = [];
        $filesKept = 0;

        foreach ($orphans->groupBy(fn (PageAsset $asset) => $asset->disk.'|'.$asset->path) as $group) {
            $reference = $group->first();

            $totalReferences = PageAsset::query()
                ->where('disk', $reference->disk)
                ->where('path', $reference->path)
                ->count();

            if ($totalReferences === $group->count()) {
                $filesToDelete[] = ['disk' => $reference->disk, 'path' => $reference->path];

                continue;
            }

            $filesKept++;
        }

        $rowsDeleted = PageAsset::query()
            ->whereIn('id', $orphans->pluck('id'))
            ->delete();

        $filesDeleted = 0;

        foreach ($filesToDelete as $file) {
            $storage = Storage::disk($file['disk']);

            if ($storage->exists($file['path'])) {
                $storage->delete($file['path']);
                $filesDeleted++;
            }
        }

        return new PrunePageAssetsResult(
            rowsDeleted: $rowsDeleted,
            filesDeleted: $filesDeleted,
            filesKept: $filesKept,
        );
    }
}
