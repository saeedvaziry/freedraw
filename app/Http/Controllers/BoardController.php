<?php

namespace App\Http\Controllers;

use App\Http\Resources\Pages\PageResource;
use App\Models\Page;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Attributes\Controllers\Middleware;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class BoardController extends Controller
{
    /**
     * Display the board. Guests use a local-only board; authenticated users are
     * moved to their most recently updated visible page when one exists.
     */
    public function home(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $organization = $user?->currentOrganization;

        if (! $user || ! $organization) {
            return Inertia::render('board', $this->props($request, $user));
        }

        $page = $organization->pages()
            ->visibleTo($user)
            ->latest('updated_at')
            ->first();

        if ($page) {
            return to_route('pages.show', $page);
        }

        return Inertia::render('board', $this->props($request, $user, pages: collect()));
    }

    /**
     * Display an organization page.
     */
    #[Middleware('auth')]
    public function show(Request $request, Page $page): Response
    {
        $user = $request->user();

        abort_unless($user !== null, 403);
        $this->authorize('view', $page);

        if (! $user->isCurrentOrganization($page->organization)) {
            $user->switchOrganization($page->organization);
        }

        return Inertia::render('board', $this->props(
            $request,
            $user,
            page: $page,
            pages: $page->organization->pages()->visibleTo($user)->latest('updated_at')->get(),
        ));
    }

    /**
     * @param  Collection<int, Page>|null  $pages
     * @return array<string, mixed>
     */
    private function props(Request $request, ?User $user, ?Page $page = null, ?Collection $pages = null): array
    {
        return [
            'boardPage' => $page ? PageResource::make($page, $user)->resolve($request) : null,
            'boardPages' => $pages?->map(fn (Page $page) => PageResource::make($page, $user, includeDocument: false)->resolve($request))->values() ?? [],
        ];
    }
}
