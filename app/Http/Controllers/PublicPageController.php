<?php

namespace App\Http\Controllers;

use App\Enums\PageVisibility;
use App\Http\Controllers\Concerns\SerializesPages;
use App\Models\Page;
use Inertia\Inertia;
use Inertia\Response;

class PublicPageController extends Controller
{
    use SerializesPages;

    /**
     * Display a publicly shared page to any visitor as a read-only board.
     */
    public function show(string $slug): Response
    {
        $page = Page::query()
            ->where('share_slug', $slug)
            ->where('visibility', PageVisibility::Public->value)
            ->firstOrFail();

        return Inertia::render('board', [
            'boardPage' => $this->serializePublicPage($page),
            'boardPages' => [],
            'boardAccess' => [
                'isPublic' => true,
                'canEdit' => false,
            ],
        ]);
    }
}
