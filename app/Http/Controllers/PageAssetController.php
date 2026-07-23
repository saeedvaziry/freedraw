<?php

namespace App\Http\Controllers;

use App\Actions\Pages\UploadPageAsset;
use App\Http\Requests\Pages\StorePageAssetRequest;
use App\Http\Resources\Pages\PageAssetResource;
use App\Models\Page;
use App\Models\PageAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Attributes\Controllers\Middleware;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[Middleware('auth')]
class PageAssetController extends Controller
{
    public function store(StorePageAssetRequest $request, Page $page, UploadPageAsset $uploadPageAsset): JsonResponse
    {
        $asset = $uploadPageAsset->handle($request->toDto());

        return response()->json(
            PageAssetResource::make($asset, $page)->resolve($request),
            $asset->wasRecentlyCreated ? 201 : 200,
        );
    }

    public function show(Request $request, Page $page, string $assetId): StreamedResponse
    {
        abort_unless($request->user()?->can('view', $page) ?? false, 403);

        $asset = $page->assets()->where('asset_id', $assetId)->firstOrFail();

        return $this->stream($asset, 'private, max-age=31536000, immutable');
    }

    private function stream(PageAsset $asset, string $cacheControl): StreamedResponse
    {
        return Storage::disk($asset->disk)->response($asset->path, $asset->asset_id, [
            'Content-Type' => $asset->mime,
            'Cache-Control' => $cacheControl,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
