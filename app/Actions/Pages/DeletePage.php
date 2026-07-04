<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\DeletePageData;

class DeletePage
{
    public function handle(DeletePageData $data): ?string
    {
        $organization = $data->page->organization;

        $data->page->delete();

        $nextPage = $organization->pages()
            ->visibleTo($data->user)
            ->latest('updated_at')
            ->first();

        return $nextPage ? route('pages.show', $nextPage) : route('home');
    }
}
