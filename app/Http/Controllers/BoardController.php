<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\SerializesPages;
use App\Models\Page;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class BoardController extends Controller
{
    use SerializesPages;

    /**
     * Display the board. Guests use a local-only board; authenticated users are
     * moved to their most recently updated visible page when one exists.
     */
    public function home(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        $organization = $user?->currentOrganization;

        if (! $user || ! $organization) {
            return Inertia::render('board', $this->props($user));
        }

        $page = $organization->pages()
            ->visibleTo($user)
            ->latest('updated_at')
            ->first();

        if ($page) {
            return to_route('pages.show', $page);
        }

        return Inertia::render('board', $this->props($user, pages: collect()));
    }

    /**
     * Display an organization page.
     */
    public function show(Request $request, Page $page): Response
    {
        $user = $request->user();

        abort_unless($user, 403);
        $this->authorize('view', $page);

        if (! $user->isCurrentOrganization($page->organization)) {
            $user->switchOrganization($page->organization);
        }

        return Inertia::render('board', $this->props(
            $user,
            page: $page,
            pages: $page->organization->pages()->visibleTo($user)->latest('updated_at')->get(),
        ));
    }

    /**
     * @param  Collection<int, Page>|null  $pages
     * @return array<string, mixed>
     */
    private function props(?User $user, ?Page $page = null, ?Collection $pages = null): array
    {
        return [
            'boardPage' => $page ? $this->serializePage($page, $user) : null,
            'boardPages' => $pages?->map(fn (Page $page) => $this->serializePage($page, $user, includeDocument: false))->values() ?? [],
        ];
    }
}
