<?php

namespace App\Http\Controllers;

use App\Models\Page;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PageController extends Controller
{
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

        return response()->json($this->serializePage($page), 201);
    }

    /**
     * Update the page document and metadata.
     */
    public function update(Request $request, Page $page): JsonResponse
    {
        $user = $request->user();

        abort_unless($user && $user->belongsToOrganization($page->organization), 403);

        $validated = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'document' => ['sometimes', 'nullable', 'string'],
        ]);

        if (array_key_exists('title', $validated)) {
            $validated['title'] = $this->normalizeTitle($validated['title']);
        }

        $page->fill($validated);
        $page->save();

        return response()->json($this->serializePage($page->refresh()));
    }

    /**
     * Delete the page.
     */
    public function destroy(Request $request, Page $page): JsonResponse
    {
        $user = $request->user();

        abort_unless($user && $user->belongsToOrganization($page->organization), 403);

        $organization = $page->organization;

        $page->delete();

        $nextPage = $organization->pages()
            ->latest('updated_at')
            ->first();

        return response()->json([
            'redirectUrl' => $nextPage ? route('pages.show', $nextPage) : route('home'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePage(Page $page): array
    {
        return [
            'publicId' => $page->public_id,
            'organizationId' => $page->organization_id,
            'title' => $page->title,
            'document' => $page->document,
            'url' => route('pages.show', $page),
            'updatedAt' => $page->updated_at?->toISOString(),
        ];
    }

    private function normalizeTitle(?string $title): string
    {
        $title = trim($title ?? '');

        return $title === '' ? 'Untitled page' : $title;
    }
}
