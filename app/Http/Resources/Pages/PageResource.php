<?php

namespace App\Http\Resources\Pages;

use App\Enums\PageVisibility;
use App\Models\Page;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Page
 */
class PageResource extends JsonResource
{
    public function __construct(
        Page $resource,
        private ?User $viewer = null,
        private bool $includeDocument = true,
        private bool $public = false,
    ) {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $shareUrl = $this->visibility === PageVisibility::Public && $this->share_slug
            ? route('share.show', $this->share_slug)
            : null;

        return [
            'publicId' => $this->public_id,
            'organizationId' => $this->organization_id,
            'title' => $this->title,
            'document' => $this->includeDocument ? $this->document : null,
            'url' => $this->public ? route('share.show', $this->share_slug) : route('pages.show', $this->resource),
            'visibility' => $this->visibility->value,
            'permission' => $this->permission->value,
            'shareUrl' => $shareUrl,
            'canShare' => ! $this->public && $this->viewer !== null && $this->viewer->can('share', $this->resource),
            'canEdit' => ! $this->public && $this->viewer !== null && $this->viewer->can('update', $this->resource),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
