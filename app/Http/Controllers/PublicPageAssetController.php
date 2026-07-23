<?php

namespace App\Http\Controllers;

use App\Enums\PageVisibility;
use App\Models\Page;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicPageAssetController extends Controller
{
    public function show(string $slug, string $assetId): StreamedResponse
    {
        $page = Page::query()
            ->where('share_slug', $slug)
            ->where('visibility', PageVisibility::Public->value)
            ->firstOrFail();

        $asset = $page->assets()->where('asset_id', $assetId)->firstOrFail();

        return Storage::disk($asset->disk)->response($asset->path, $asset->asset_id, [
            'Content-Type' => $asset->mime,
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
