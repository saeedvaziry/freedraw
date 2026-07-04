<?php

namespace App\Actions\Pages;

use App\DTOs\Pages\UpdatePageData;
use App\Models\Page;

class UpdatePage
{
    public function handle(UpdatePageData $data): Page
    {
        $attributes = [];

        if ($data->hasTitle) {
            $attributes['title'] = $this->normalizeTitle($data->title);
        }

        if ($data->hasDocument) {
            $attributes['document'] = $data->document;
        }

        $data->page->fill($attributes);
        $data->page->save();

        return $data->page->refresh();
    }

    private function normalizeTitle(?string $title): string
    {
        $title = trim($title ?? '');

        return $title === '' ? 'Untitled page' : $title;
    }
}
