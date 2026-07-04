<?php

namespace App\Http\Controllers;

use App\Actions\Pages\UpdatePageSharing;
use App\Http\Requests\Pages\UpdatePageSharingRequest;
use App\Http\Resources\Pages\PageResource;
use App\Models\Page;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Attributes\Controllers\Middleware;

#[Middleware('auth')]
class PageShareController extends Controller
{
    /**
     * Update a page's sharing settings.
     */
    public function update(UpdatePageSharingRequest $request, Page $page, UpdatePageSharing $updatePageSharing): JsonResponse
    {
        $page = $updatePageSharing->handle($request->toDto());

        return response()->json(PageResource::make($page, $request->user())->resolve($request));
    }
}
