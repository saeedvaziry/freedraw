<?php

namespace App\Http\Requests\Pages;

use App\DTOs\Pages\UpdatePageData;
use App\Models\Page;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->page()) ?? false;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'nullable', 'string', 'max:120'],
            'document' => ['sometimes', 'nullable', 'string'],
        ];
    }

    public function toDto(): UpdatePageData
    {
        $validated = $this->validated();

        return new UpdatePageData(
            page: $this->page(),
            title: $validated['title'] ?? null,
            document: $validated['document'] ?? null,
            hasTitle: array_key_exists('title', $validated),
            hasDocument: array_key_exists('document', $validated),
        );
    }

    private function page(): Page
    {
        $page = $this->route('page');

        abort_unless($page instanceof Page, 404);

        return $page;
    }
}
