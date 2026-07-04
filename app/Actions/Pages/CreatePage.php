<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\CreatePageData;
use App\Models\Page;

class CreatePage
{
    public function handle(CreatePageData $data): Page
    {
        $organization = $data->user->currentOrganization;

        abort_unless($organization && $data->user->belongsToOrganization($organization), 403);

        return $organization->pages()->create([
            'created_by' => $data->user->id,
            'title' => $this->normalizeTitle($data->title),
            'document' => $data->document,
        ]);
    }

    private function normalizeTitle(?string $title): string
    {
        $title = trim($title ?? '');

        return $title === '' ? 'Untitled page' : $title;
    }
}
