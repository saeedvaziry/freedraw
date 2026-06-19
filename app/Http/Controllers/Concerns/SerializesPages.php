<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\PageVisibility;
use App\Models\Page;
use App\Models\User;

trait SerializesPages
{
    /**
     * Serialize a page for the authenticated board, including the viewer's
     * sharing capabilities so the client can render the right controls.
     *
     * @return array<string, mixed>
     */
    protected function serializePage(Page $page, ?User $user, bool $includeDocument = true): array
    {
        return [
            'publicId' => $page->public_id,
            'organizationId' => $page->organization_id,
            'title' => $page->title,
            'document' => $includeDocument ? $page->document : null,
            'url' => route('pages.show', $page),
            'visibility' => $page->visibility->value,
            'permission' => $page->permission->value,
            'shareUrl' => $page->visibility === PageVisibility::Public && $page->share_slug
                ? route('share.show', $page->share_slug)
                : null,
            'canShare' => $user !== null && $user->can('share', $page),
            'canEdit' => $user !== null && $user->can('update', $page),
            'updatedAt' => $page->updated_at?->toISOString(),
        ];
    }

    /**
     * Serialize a publicly shared page for a guest viewer. Guests can never
     * edit or manage sharing, so those capabilities are always false.
     *
     * @return array<string, mixed>
     */
    protected function serializePublicPage(Page $page): array
    {
        return [
            'publicId' => $page->public_id,
            'organizationId' => $page->organization_id,
            'title' => $page->title,
            'document' => $page->document,
            'url' => route('share.show', $page->share_slug),
            'visibility' => $page->visibility->value,
            'permission' => $page->permission->value,
            'shareUrl' => route('share.show', $page->share_slug),
            'canShare' => false,
            'canEdit' => false,
            'updatedAt' => $page->updated_at?->toISOString(),
        ];
    }
}
