<?php

namespace App\Http\Controllers;

use App\Enums\PagePermission;
use App\Enums\PageVisibility;
use App\Http\Controllers\Concerns\SerializesPages;
use App\Models\Page;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Enum;

class PageShareController extends Controller
{
    use SerializesPages;

    /**
     * Update a page's sharing settings.
     */
    public function update(Request $request, Page $page): JsonResponse
    {
        $user = $request->user();

        abort_unless($user !== null, 403);
        $this->authorize('share', $page);

        $validated = $request->validate([
            'visibility' => ['required', new Enum(PageVisibility::class)],
            'permission' => ['required', new Enum(PagePermission::class)],
        ]);

        $visibility = PageVisibility::from($validated['visibility']);

        // Public pages are always view-only; edit permission only applies to
        // organization shares.
        $permission = $visibility === PageVisibility::Organization
            ? PagePermission::from($validated['permission'])
            : PagePermission::View;

        $page->visibility = $visibility;
        $page->permission = $permission;

        if ($visibility === PageVisibility::Public) {
            $page->enablePublicSharing();
        } else {
            $page->disablePublicSharing();
        }

        $page->save();

        return response()->json($this->serializePage($page->refresh(), $user));
    }
}
