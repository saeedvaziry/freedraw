<?php

namespace App\Http\Controllers;

use App\Models\Page;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class BoardController extends Controller
{
    /**
     * Display the board. Guests use a local-only board; authenticated users are
     * moved to their most recently updated organization page when one exists.
     */
    public function home(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $organization = $user?->currentOrganization;

        if (! $user || ! $organization) {
            return Inertia::render('board', $this->props());
        }

        $page = $organization->pages()
            ->latest('updated_at')
            ->first();

        if ($page) {
            return to_route('pages.show', $page);
        }

        return Inertia::render('board', $this->props(pages: collect()));
    }

    /**
     * Display an organization page.
     */
    public function show(Request $request, Page $page): Response
    {
        $user = $request->user();

        abort_unless($user && $user->belongsToOrganization($page->organization), 403);

        if (! $user->isCurrentOrganization($page->organization)) {
            $user->switchOrganization($page->organization);
        }

        return Inertia::render('board', $this->props(
            page: $page,
            pages: $page->organization->pages()->latest('updated_at')->get(),
        ));
    }

    /**
     * @param  Collection<int, Page>|null  $pages
     * @return array<string, mixed>
     */
    private function props(?Page $page = null, ?Collection $pages = null): array
    {
        return [
            'boardPage' => $page ? $this->serializePage($page) : null,
            'boardPages' => $pages?->map(fn (Page $page) => $this->serializePage($page, includeDocument: false))->values() ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePage(Page $page, bool $includeDocument = true): array
    {
        return [
            'publicId' => $page->public_id,
            'organizationId' => $page->organization_id,
            'title' => $page->title,
            'document' => $includeDocument ? $page->document : null,
            'url' => route('pages.show', $page),
            'updatedAt' => $page->updated_at?->toISOString(),
        ];
    }
}
