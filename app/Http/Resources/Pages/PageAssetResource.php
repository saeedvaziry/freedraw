<?php

namespace App\Http\Resources\Pages;

use App\Models\Page;
use App\Models\PageAsset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PageAsset
 */
class PageAssetResource extends JsonResource
{
    public function __construct(
        PageAsset $resource,
        private Page $page,
    ) {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'assetId' => $this->asset_id,
            'mime' => $this->mime,
            'size' => $this->size,
            'contentHash' => $this->content_hash,
            'url' => route('pages.assets.show', ['page' => $this->page, 'assetId' => $this->asset_id]),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
