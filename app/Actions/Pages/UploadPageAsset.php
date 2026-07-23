<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\UploadPageAssetData;
use App\Models\PageAsset;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class UploadPageAsset
{
    private const DISK = 'assets';

    public function handle(UploadPageAssetData $data): PageAsset
    {
        $contents = $data->file->get();

        if (! is_string($contents)) {
            throw new RuntimeException('Unable to read the uploaded asset.');
        }

        $contentHash = hash('sha256', $contents);
        $path = $this->pathFor($contentHash);

        $disk = Storage::disk(self::DISK);

        if (! $disk->exists($path)) {
            $disk->put($path, $contents);
        }

        return $data->page->assets()->updateOrCreate(
            ['asset_id' => $data->assetId],
            [
                'disk' => self::DISK,
                'path' => $path,
                'content_hash' => $contentHash,
                'mime' => $data->file->getMimeType() ?? $data->file->getClientMimeType(),
                'size' => $data->file->getSize(),
            ],
        );
    }

    private function pathFor(string $contentHash): string
    {
        return sprintf('%s/%s/%s', substr($contentHash, 0, 2), substr($contentHash, 2, 2), $contentHash);
    }
}
