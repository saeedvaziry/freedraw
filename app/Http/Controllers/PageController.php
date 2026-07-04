<?php

namespace App\Http\Controllers;

use App\Actions\Pages\CreatePage;
use App\Actions\Pages\DeletePage;
use App\Actions\Pages\UpdatePage;
use App\Http\Requests\Pages\DeletePageRequest;
use App\Http\Requests\Pages\StorePageRequest;
use App\Http\Requests\Pages\UpdatePageRequest;
use App\Http\Resources\Pages\PageResource;
use App\Models\Page;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Attributes\Controllers\Middleware;

#[Middleware('auth')]
class PageController extends Controller
{
    /**
     * Store a new page in the user's current organization.
     */
    public function store(StorePageRequest $request, CreatePage $createPage): JsonResponse
    {
        $page = $createPage->handle($request->toDto());

        return response()->json(PageResource::make($page, $request->user())->resolve($request), 201);
    }

    /**
     * Update the page document and metadata.
     */
    public function update(UpdatePageRequest $request, Page $page, UpdatePage $updatePage): JsonResponse
    {
        $page = $updatePage->handle($request->toDto());

        return response()->json(PageResource::make($page, $request->user())->resolve($request));
    }

    /**
     * Delete the page.
     */
    public function destroy(DeletePageRequest $request, Page $page, DeletePage $deletePage): JsonResponse
    {
        $redirectUrl = $deletePage->handle($request->toDto());

        return response()->json([
            'redirectUrl' => $redirectUrl,
        ]);
    }
}
