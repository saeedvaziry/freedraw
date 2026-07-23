<?php

namespace App\DTOs\Pages;

use App\Models\Page;
use Illuminate\Http\UploadedFile;

readonly class UploadPageAssetData
{
    public function __construct(
        public Page $page,
        public string $assetId,
        public UploadedFile $file,
    ) {}
}
