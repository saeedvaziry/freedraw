<?php

namespace App\Http\Controllers;

use App\Enums\PageVisibility;
use App\Http\Resources\Pages\PageResource;
use App\Models\Page;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PublicPageController extends Controller
{
    /**
     * Display a publicly shared page to any visitor as a read-only board.
     */
    public function show(Request $request, string $slug): Response
    {
        $page = Page::query()
            ->where('share_slug', $slug)
            ->where('visibility', PageVisibility::Public->value)
            ->firstOrFail();

        return Inertia::render('board', [
            'boardPage' => PageResource::make($page, includeDocument: true, public: true)->resolve($request),
            'boardPages' => [],
            'boardAccess' => [
                'isPublic' => true,
                'canEdit' => false,
            ],
        ]);
    }
}
