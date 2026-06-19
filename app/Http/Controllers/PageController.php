<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\SerializesPages;
use App\Models\Page;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PageController extends Controller
{
    use SerializesPages;

    /**
     * Store a new page in the user's current organization.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $organization = $user?->currentOrganization;

        abort_unless($user && $organization && $user->belongsToOrganization($organization), 403);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:120'],
            'document' => ['nullable', 'string'],
        ]);

        $page = $organization->pages()->create([
            'created_by' => $user->id,
            'title' => $this->normalizeTitle($validated['title'] ?? null),
            'document' => $validated['document'] ?? null,
        ]);

        return response()->json($this->serializePage($page, $user), 201);
    }

    /**
     * Update the page document and metadata.
     */
    public function update(Request $request, Page $page): JsonResponse
    {
        $user = $request->user();

        abort_unless($user, 403);
        $this->authorize('update', $page);

        $validated = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'document' => ['sometimes', 'nullable', 'string'],
        ]);

        if (array_key_exists('title', $validated)) {
            $validated['title'] = $this->normalizeTitle($validated['title']);
        }

        $page->fill($validated);
        $page->save();

        return response()->json($this->serializePage($page->refresh(), $user));
    }

    /**
     * Delete the page.
     */
    public function destroy(Request $request, Page $page): JsonResponse
    {
        $user = $request->user();

        abort_unless($user, 403);
        $this->authorize('delete', $page);

        $organization = $page->organization;

        $page->delete();

        $nextPage = $organization->pages()
            ->visibleTo($user)
            ->latest('updated_at')
            ->first();

        return response()->json([
            'redirectUrl' => $nextPage ? route('pages.show', $nextPage) : route('home'),
        ]);
    }

    private function normalizeTitle(?string $title): string
    {
        $title = trim($title ?? '');

        return $title === '' ? 'Untitled page' : $title;
    }
}
