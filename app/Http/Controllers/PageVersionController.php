<?php

namespace App\Http\Controllers;

use App\Actions\Pages\CreateNamedSnapshot;
use App\Actions\Pages\RestorePageVersion;
use App\Http\Requests\Pages\RestorePageVersionRequest;
use App\Http\Requests\Pages\StorePageVersionRequest;
use App\Http\Resources\Pages\PageSnapshotResource;
use App\Models\Page;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Attributes\Controllers\Middleware;

#[Middleware('auth')]
class PageVersionController extends Controller
{
    public function index(Request $request, Page $page): JsonResponse
    {
        abort_unless($request->user()?->can('view', $page) ?? false, 403);

        $versions = $page->snapshots()
            ->whereNotNull('label')
            ->with('creator')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return response()->json(PageSnapshotResource::collection($versions)->resolve($request));
    }

    public function store(StorePageVersionRequest $request, Page $page, CreateNamedSnapshot $createNamedSnapshot): JsonResponse
    {
        $snapshot = $createNamedSnapshot->handle($request->toDto());

        return response()->json(PageSnapshotResource::make($snapshot)->resolve($request), 201);
    }

    public function restore(RestorePageVersionRequest $request, Page $page, RestorePageVersion $restorePageVersion): JsonResponse
    {
        $snapshot = $restorePageVersion->handle($request->toDto());

        return response()->json(PageSnapshotResource::make($snapshot)->resolve($request), 201);
    }
}
